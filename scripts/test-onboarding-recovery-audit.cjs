const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
function load(file, mocks) {
  const module = { exports: {} }
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  new Function('require', 'module', 'exports', output)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const json = (body, options) => ({ body, status: options?.status ?? 200 })
const request = body => ({
  headers: new Headers({ origin: 'https://bookeasy.ro' }),
  nextUrl: { origin: 'https://bookeasy.ro' },
  json: async () => body,
})

async function main() {
  let roomCount = 0
  const onboarding = load('app/api/onboarding/route.ts', {
    '@/lib/business-public-slug': { setPublicSlug: async () => {} },
    'next/server': { NextResponse: { json } },
    '@/lib/prisma': { prisma: { business: { findUnique: async () => ({ category: 'EVENT_VENUE', categoryLocked: false, onboardingDone: false, city: 'Zalău', _count: { services: 0, resources: roomCount, workingHours: 1 } }) } } },
    '@/lib/business-auth': { auth: async () => ({ businessId: 'venue' }) },
    '@/lib/geocode': { geocodeAddress: async () => null },
    '@/lib/venue-services': { ensureVenueService: async () => {} },
    '@/lib/romanian-cities': { canonicalCity: value => value },
    '@/lib/business-categories': { PUBLIC_CATEGORIES: ['SALON', 'EVENT_VENUE'], isAppointmentCategory: value => value === 'SALON' },
    '@/lib/launch-campaign': { LaunchSignupError: class extends Error {}, activateLaunch: async () => {}, activateStandardSubscription: async () => {}, launchSignupData: async () => ({}), lockLaunchBusiness: async () => {} },
    '@/lib/promotion-campaigns': { hasOpenPromotion: async () => false },
  })
  const emptyStep = await onboarding.POST(request({ step: 3, data: { services: [] } }))
  assert.equal(emptyStep.status, 400)
  assert.match(emptyStep.body.error, /cel puțin o sală/)
  const emptyActivation = await onboarding.POST(request({ step: 5, data: {} }))
  assert.equal(emptyActivation.status, 400)
  assert.match(emptyActivation.body.error, /cel puțin o sală/)
  console.log('PASS venue requires a room both at onboarding step 3 and activation')

  const originalKey = process.env.RESEND_API_KEY
  let existing = false
  let lookupCount = 0
  const recovery = load('app/api/auth/forgot-password/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => { lookupCount++; return existing ? { id: 'user', email: 'test@example.invalid' } : null } } } },
    '@/lib/password-tokens': { createPasswordToken: async () => 'token', sendPasswordResetEmail: async () => {}, withEmailTimeout: async () => null },
    '@/lib/rate-limit': { rateLimit: async () => ({ allowed: true }), getClientIp: () => '127.0.0.1' },
  })
  const recoveryRequest = () => request({ email: 'test@example.invalid', accountType: 'business' })
  try {
    delete process.env.RESEND_API_KEY
    const unavailable = await recovery.POST(recoveryRequest())
    assert.equal(unavailable.status, 503)
    assert.equal(lookupCount, 0)
    process.env.RESEND_API_KEY = 'test-key'
    const missingAccount = await recovery.POST(recoveryRequest())
    existing = true
    const failedDelivery = await recovery.POST(recoveryRequest())
    assert.deepEqual(failedDelivery, missingAccount)
    console.log('PASS missing mail configuration is reported before account lookup; delivery failure does not reveal account existence')
  } finally {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
