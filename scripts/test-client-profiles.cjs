const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest } = require('next/server')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((name) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

async function main() {
  let saved = null
  let lookup
  const prisma = { clientProfile: {
    findUnique: async (query) => { lookup = query; return saved },
    upsert: async (query) => { saved = { id: 'profile-1', ...query.create }; return saved },
  }, booking: { findFirst: async ({ where }) => { assert.equal(where.reviewerGoogleSub, 'google-1'); return { customer: { phone: '0745123456' } } } } }
  const profile = load('lib/client-profile.ts', { './prisma': { prisma } })
  const google = { role: 'CUSTOMER', googleSub: 'google-1', userId: 'google:google-1', firstName: 'Ana Maria', lastName: 'Popescu', user: { name: 'Ana Maria Popescu', email: 'client@example.com' } }
  assert.equal(profile.clientIdentity({ ...google, role: 'OWNER' }), null)
  assert.equal(profile.clientIdentity({ ...google, user: {} }), null)
  assert.equal(profile.clientIdentity(google).ownerKey, 'google:google-1')
  assert.deepEqual(await profile.getClientProfile(google), { firstName: 'Ana Maria', lastName: 'Popescu', email: 'client@example.com', phone: '0745123456' })
  assert.deepEqual(lookup.where, { ownerKey: 'google:google-1' })
  await profile.saveBookingClientProfile(profile.clientIdentity(google), 'Ana Maria Popescu', '0745987654')
  assert.equal(saved.firstName, 'Ana Maria', 'Keep compound given name from Google')
  assert.equal(saved.lastName, 'Popescu')
  assert.equal((await profile.getClientProfile(google)).phone, '0745987654')
  const simple = { role: 'CUSTOMER', userId: 'user-2', user: { email: 'simple@example.com' } }
  assert.equal(profile.clientIdentity(simple).ownerKey, 'user:user-2')

  let session = google
  const api = load('app/api/customer/profile/route.ts', {
    '@/lib/auth': { auth: async () => session }, '@/lib/prisma': { prisma }, '@/lib/client-profile': profile,
  })
  const request = (body, origin = 'https://www.bookeasy.ro') => new NextRequest('https://www.bookeasy.ro/api/customer/profile', { method: 'PATCH', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const body = { firstName: 'Ana', lastName: 'Popescu', phone: '0745123456', email: 'attacker@example.com', ownerKey: 'user:someone-else' }
  assert.equal((await api.PATCH(request(body, 'https://other.example'))).status, 403)
  session = null
  assert.equal((await api.PATCH(request(body))).status, 401)
  session = { ...google, role: 'OWNER' }
  assert.equal((await api.PATCH(request(body))).status, 401)
  session = google
  assert.equal((await api.PATCH(request({ ...body, phone: 'abcdefg' }))).status, 400)
  assert.equal((await api.PATCH(request(body))).status, 200)
  assert.equal(saved.ownerKey, 'google:google-1')
  assert.equal(saved.email, 'client@example.com')
  let customerData
  let bookingData
  const startAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const bookingPrisma = {
    business: { findUnique: async () => ({ id: 'business', publicListed: true, accountActive: true }) },
    service: { findUnique: async () => ({ id: 'service', businessId: 'business', active: true, type: 'APPOINTMENT', durationMin: 30 }) },
    customer: { upsert: async (query) => { customerData = query.create; return { id: 'customer' } } },
    booking: { create: async (query) => { bookingData = query.data; return { id: 'booking' } } },
  }
  const bookingApi = load('app/api/public/bookings/route.ts', {
    '@/lib/prisma': { prisma: bookingPrisma }, '@/lib/auth': { auth: async () => session },
    '@/lib/client-profile': profile,
    '@/lib/availability': { isIntervalBlocked: async () => false, isWithinLeadTime: async () => false, getDaySlotsWithStatus: async () => [{ time: startAt, available: true }], isSlotStillAvailable: async () => true },
    '@/lib/venue-services': {}, '@/lib/booking-number': { getNextSequenceNumber: async () => 1 },
    '@/lib/google-calendar': { syncBookingToGoogle: async () => {} },
    '@/lib/rate-limit': { getClientIp: () => 'test', rateLimit: () => ({ allowed: true }) },
  })
  const bookRequest = (data) => new NextRequest('https://www.bookeasy.ro/api/public/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
  const bookingInput = { businessId: 'business', serviceId: 'service', startAt, customerName: 'Ana Popescu', customerPhone: '0745123456', customerEmail: 'attacker@example.com' }
  assert.equal((await bookingApi.POST(bookRequest(bookingInput))).status, 200)
  assert.equal(customerData.email, 'client@example.com')
  assert.equal(bookingData.clientProfileId, 'profile-1')
  assert.equal(bookingData.reviewerGoogleSub, 'google-1')
  session = simple
  assert.equal((await bookingApi.POST(bookRequest(bookingInput))).status, 200)
  assert.equal(customerData.email, 'simple@example.com')
  assert.equal(bookingData.reviewerGoogleSub, null)
  assert.equal(saved.ownerKey, 'user:user-2')
  session = null
  assert.equal((await bookingApi.POST(bookRequest({ ...bookingInput, customerEmail: undefined }))).status, 200)
  assert.equal(bookingData.clientProfileId, null)
  assert.equal((await bookingApi.POST(bookRequest({ ...bookingInput, customerPhone: 'abcdefg' }))).status, 400)
  console.log('Client profiles passed: Google names, own-booking phone fallback, saved contact reuse, role isolation, session-owned email and profile ownership.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
