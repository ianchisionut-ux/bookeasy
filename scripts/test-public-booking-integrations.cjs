const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
function load(file, mocks) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

async function main() {
  const callbacks = []
  const synced = []
  const calendar = load('lib/public-booking-calendar-sync.ts', {
    'next/server': { after: callback => callbacks.push(callback) },
    './google-calendar': { syncBookingToGoogle: async id => { synced.push(id) } },
  })
  calendar.schedulePublicBookingCalendarSync('new-booking', 'cancelled-booking')
  assert.deepEqual(synced, [], 'Calendar work must not delay the booking response')
  assert.equal(callbacks.length, 1)
  await callbacks[0]()
  assert.deepEqual(synced, ['cancelled-booking', 'new-booking'], 'Rescheduling must remove the old event before creating the new one')

  const previous = {}
  const config = {
    GOOGLE_WALLET_ENABLED: 'true',
    GOOGLE_WALLET_PUBLISHING_APPROVED: 'true',
    GOOGLE_WALLET_ISSUER_ID: 'issuer',
    GOOGLE_WALLET_CLASS_ID: 'issuer.class',
    GOOGLE_WALLET_QR_SECRET: '0123456789abcdef0123456789abcdef',
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'wallet@example.invalid', private_key: 'fixture-key' }),
  }
  for (const [key, value] of Object.entries(config)) { previous[key] = process.env[key]; process.env[key] = value }
  try {
    const wallet = load('lib/google-wallet.ts', {
      './business-plans': { effectiveBusinessPlan: () => 'PRO' },
      './wallet-eligibility': { isWalletEligibleCategory: () => true },
    })
    const business = { id: 'business', name: 'Demo', category: 'SALON', planName: 'PRO', billingStatus: 'GRATUIT' }
    const link = wallet.createBookingWalletRedirectUrl({ id: 'booking', business }, 'https://bookeasy.ro')
    assert(link)
    const url = new URL(link)
    assert.equal(url.origin, 'https://bookeasy.ro')
    assert.equal(url.pathname, '/api/public/bookings/booking/wallet')
    assert(wallet.verifyBookingWalletRedirectToken('booking', business.id, url.searchParams.get('token')))
    assert.equal(wallet.verifyBookingWalletRedirectToken('other-booking', business.id, url.searchParams.get('token')), false)
    assert.equal(wallet.verifyBookingWalletRedirectToken('booking', business.id, 'invalid'), false)
    process.env.GOOGLE_WALLET_PUBLISHING_APPROVED = 'false'
    assert.equal(wallet.createBookingWalletRedirectUrl({ id: 'booking', business }, 'https://bookeasy.ro'), null)
    process.env.GOOGLE_WALLET_PUBLISHING_APPROVED = 'true'

    let signed = 0
    let status = 'PENDING'
    const route = load('app/api/public/bookings/[id]/wallet/route.ts', {
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }), redirect: (to, options) => ({ to, status: options?.status ?? 307 }) } },
      '@/lib/prisma': { prisma: { booking: { findUnique: async () => ({ id: 'booking', businessId: business.id, status, startAt: new Date(), endAt: new Date(), service: { name: 'Serviciu' }, business }) } } },
      '@/lib/google-wallet': { verifyBookingWalletRedirectToken: wallet.verifyBookingWalletRedirectToken, createBookingWalletLink: async () => { signed++; return 'https://pay.google.com/gp/v/save/example' } },
    })
    const valid = await route.GET({ nextUrl: url }, { params: Promise.resolve({ id: 'booking' }) })
    assert.equal(valid.status, 302)
    assert.equal(valid.to, 'https://pay.google.com/gp/v/save/example')
    assert.equal(signed, 1)
    url.searchParams.set('token', '0'.repeat(64))
    const invalid = await route.GET({ nextUrl: url }, { params: Promise.resolve({ id: 'booking' }) })
    assert.equal(invalid.status, 404)
    assert.equal(signed, 1, 'Invalid links must not call Google')
    url.searchParams.set('token', new URL(link).searchParams.get('token'))
    status = 'CANCELLED'
    const cancelled = await route.GET({ nextUrl: url }, { params: Promise.resolve({ id: 'booking' }) })
    assert.equal(cancelled.status, 404)
    assert.equal(signed, 1, 'Cancelled bookings must not get Wallet passes')
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  console.log('PASS background Calendar sync, signed Wallet link, redirect, and invalid-token rejection')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
