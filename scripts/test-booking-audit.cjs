const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
function load(file, mocks = {}) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const json = (body, options) => ({ body, status: options?.status ?? 200 })
const token = '00000000-0000-4000-8000-000000000001'

async function testDaylightSaving() {
  const prisma = {
    service: {
      findFirst: async () => ({ id: 'service', type: 'APPOINTMENT', durationMin: 30 }),
      findMany: async () => [{ durationMin: 30 }],
    },
    business: { findUnique: async () => ({ slotIntervalMinutes: 30, minLeadTimeMinutes: 0 }) },
    workingHours: { findMany: async () => [{ startTime: '09:00', endTime: '10:00' }] },
    booking: { findMany: async () => [] },
    blockedSlot: { findMany: async () => [] },
  }
  const { getDaySlotsWithStatus } = load('lib/availability.ts', { './prisma': { prisma } })
  for (const day of ['2026-03-29', '2026-10-25']) {
    const slots = await getDaySlotsWithStatus('business', 'service', new Date(`${day}T00:00:00Z`), true)
    const times = slots.map(slot => new Date(slot.time).toLocaleTimeString('en-GB', {
      timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hour12: false,
    }))
    assert.deepEqual(times, ['09:00', '09:30'], day)
  }
  console.log('PASS Bucharest slots stay at 09:00 across both DST transitions')
}

async function testBookingNumber() {
  let queried
  const { getNextSequenceNumber } = load('lib/booking-number.ts', {
    './prisma': { prisma: { booking: { count: async ({ where }) => { queried = where; return 2 } } } },
  })
  assert.equal(await getNextSequenceNumber('business'), 3)
  const now = new Date()
  assert.equal(queried.createdAt.gte.getMonth(), now.getMonth())
  assert.equal(queried.createdAt.gte.getFullYear(), now.getFullYear())
  console.log('PASS reference numbers use creation month')
}

async function testRescheduleLink() {
  const booking = {
    id: 'old', status: 'PENDING', startAt: new Date('2027-12-10T10:00:00Z'),
    confirmationRequestToken: token, confirmationRequestSent: true, customerConfirmed: null,
    business: { slug: 'salon' },
  }
  const route = load('app/api/public/bookings/[id]/sms-confirmation/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/prisma': { prisma: { booking: {
      findUnique: async () => booking,
      updateMany: async () => { throw new Error('Reschedule must not cancel before selection') },
    } } },
    '@/lib/google-calendar': { syncBookingToGoogle: async () => {} },
  })
  const response = await route.POST({ json: async () => ({ token, action: 'RESCHEDULE' }) }, { params: Promise.resolve({ id: 'old' }) })
  assert.equal(response.status, 200)
  assert.equal(response.body.rebookUrl, `/salon/rezerva?rescheduleId=old&rescheduleToken=${token}`)
  assert.equal(booking.status, 'PENDING')
  console.log('PASS reprogram link preserves original booking')
}

async function testAtomicTransfer() {
  const startAt = new Date('2027-12-11T10:00:00Z')
  const previous = {
    businessId: 'business', status: 'PENDING', startAt: new Date('2027-12-10T10:00:00Z'),
    confirmationRequestToken: token, confirmationRequestSent: true, customerConfirmed: null,
  }
  let failCreate = true
  let created = 0
  const tx = { booking: {
    updateMany: async () => {
      if (previous.status !== 'PENDING' || previous.customerConfirmed !== null) return { count: 0 }
      previous.status = 'CANCELLED'
      previous.customerConfirmed = false
      return { count: 1 }
    },
    create: async ({ data }) => {
      if (failCreate) throw new Error('BOOKEASY_SLOT_CONFLICT')
      created++
      return { id: `new-${created}`, startAt: data.startAt, endAt: data.endAt }
    },
  } }
  const business = { id: 'business', publicListed: true, accountActive: true, latitude: null, longitude: null }
  const prisma = {
    business: { findUnique: async () => business },
    service: { findUnique: async () => ({ id: 'service', businessId: 'business', active: true, type: 'APPOINTMENT', durationMin: 30, name: 'Tuns' }) },
    booking: {
      findUnique: async () => previous,
      create: async () => { throw new Error('Creation must happen in transaction') },
    },
    customer: { upsert: async () => ({ id: 'customer' }) },
    $transaction: async callback => {
      const state = { status: previous.status, customerConfirmed: previous.customerConfirmed }
      try { return await callback(tx) }
      catch (error) { Object.assign(previous, state); throw error }
    },
  }
  const route = load('app/api/public/bookings/route.ts', {
    '@/lib/booking-conflict': { isBookingConflict: error => String(error?.message).includes('BOOKEASY_SLOT_CONFLICT') },
    'next/server': { NextResponse: { json } },
    '@/lib/prisma': { prisma },
    '@/lib/auth': { auth: async () => null },
    '@/lib/availability': {
      getDaySlotsWithStatus: async () => [{ time: startAt.toISOString(), available: true }],
      getPractitionerDaySlotsWithStatus: async () => [], getVenueDaySlotsWithStatus: async () => [],
      isSlotStillAvailable: async () => true, isIntervalBlocked: async () => false,
      isWithinLeadTime: async () => false, isPractitionerSlotStillAvailable: async () => true,
      isWithinWorkingHours: async () => true,
    },
    '@/lib/venue-services': { venueServiceId: () => 'venue' },
    '@/lib/booking-number': { getNextSequenceNumber: async () => 1 },
    '@/lib/google-calendar': { syncBookingToGoogle: async () => {} },
    '@/lib/rate-limit': { getClientIp: () => '127.0.0.1', rateLimit: async () => ({ allowed: true }) },
    '@/lib/client-profile': { clientIdentity: () => null, saveBookingClientProfile: async () => null },
    '@/lib/customer-phone': { canonicalCustomerPhone: value => value },
    '@/lib/customer-lookup': { findCustomerByPhone: async () => null },
    '@/lib/google-wallet': { createBookingWalletLink: async () => null },
  })
  const input = {
    businessId: 'business', serviceId: 'service', startAt: startAt.toISOString(),
    customerName: 'Client', customerPhone: '0712345678',
    reschedule: { bookingId: 'old', token },
  }
  const req = { json: async () => input, nextUrl: { origin: 'https://bookeasy.ro' } }
  assert.equal((await route.POST(req)).status, 409)
  assert.equal(previous.status, 'PENDING', 'failed new booking restores old one')
  failCreate = false
  assert.equal((await route.POST(req)).status, 200)
  assert.equal(previous.status, 'CANCELLED')
  assert.equal(created, 1)
  assert.equal((await route.POST(req)).status, 409)
  assert.equal(created, 1, 'replay cannot create another booking')
  console.log('PASS failed transfer rolls back; successful transfer cancels old; token replay rejected')
}

async function main() {
  await testDaylightSaving()
  await testBookingNumber()
  await testRescheduleLink()
  await testAtomicTransfer()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
