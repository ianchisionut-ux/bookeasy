// Deterministic reproductions against real route code with an in-memory database.
// No production data, external messages or payments are touched.
const fs = require('node:fs')
const crypto = require('node:crypto')
const ts = require('typescript')
const { NextRequest } = require('next/server')
function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((name) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}
async function main() {
  const bookings = []
  const start = '2030-06-12T09:00:00.000Z'
  let release
  let checked = 0
  const bothChecked = new Promise((resolve) => { release = resolve })
  const prisma = {
    business: { findUnique: async () => ({ id: 'business-a', accountActive: true, publicListed: true }) },
    service: { findUnique: async () => ({ id: 'service-a', businessId: 'business-a', active: true, type: 'APPOINTMENT', durationMin: 30 }) },
    customer: { upsert: async () => ({ id: 'customer-a' }) },
    booking: { create: async ({ data }) => { bookings.push(data); return { id: `booking-${bookings.length}`, ...data } } },
  }
  const route = load('app/api/public/bookings/route.ts', {
    '@/lib/prisma': { prisma }, '@/lib/auth': { auth: async () => null },
    '@/lib/availability': { isIntervalBlocked: async () => false, isWithinLeadTime: async () => false, getDaySlotsWithStatus: async () => [{ available: true, time: start }], isSlotStillAvailable: async () => { const free = bookings.length === 0; if (++checked === 2) release(); await bothChecked; return free } },
    '@/lib/venue-services': {}, '@/lib/booking-number': { getNextSequenceNumber: async () => 1 }, '@/lib/google-calendar': { syncBookingToGoogle: async () => {} }, '@/lib/rate-limit': { rateLimit: () => ({ allowed: true }), getClientIp: () => 'audit' }, '@/lib/client-profile': { clientIdentity: () => null },
  })
  const request = () => new NextRequest('https://www.bookeasy.ro/api/public/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: 'business-a', serviceId: 'service-a', customerName: 'Audit', customerPhone: '0712345678', startAt: start }) })
  const responses = await Promise.all([route.POST(request()), route.POST(request())])

  let suspendedWrite = false
  const branding = load('app/api/business/brand-color/route.ts', {
    '@/lib/auth': { auth: async () => ({ businessId: 'suspended-a', role: 'OWNER' }) },
    '@/lib/prisma': { prisma: { business: { findUnique: async () => ({ accountActive: false }), update: async () => { suspendedWrite = true } } } },
  })
  const brandResponse = await branding.PATCH(new NextRequest('https://www.bookeasy.ro/api/business/brand-color', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandColor: '#147f83' }) }))

  process.env.META_APP_SECRET = 'audit-meta-secret'
  const seen = new Set()
  let processingAttempts = 0
  const webhook = load('app/api/webhooks/meta/route.ts', {
    '@/lib/prisma': { prisma: { channel: { findUnique: async () => ({ id: 'channel-a', businessId: 'business-a', status: 'ACTIVE', authProvider: 'meta' }) }, processedWebhookMessage: { create: async ({ data }) => { if (seen.has(data.id)) throw new Error('duplicate'); seen.add(data.id) } } } },
    '@/lib/bot-engine': { processIncomingMessage: async () => { processingAttempts++; throw new Error('Transient processing failure') } }, '@/lib/google-calendar': {}, '@/lib/channel-senders': {},
  })
  const body = JSON.stringify({ object: 'page', entry: [{ id: 'page-a', messaging: [{ sender: { id: 'audit-sender' }, message: { mid: 'audit-message', text: 'Audit only' } }] }] })
  const signed = () => new NextRequest('https://www.bookeasy.ro/api/webhooks/meta', { method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex')}` } })
  try { await webhook.POST(signed()) } catch { /* Simulate Meta retry after failed processing. */ }
  const retry = await webhook.POST(signed())
  console.log(JSON.stringify({ mockedOnly: true, concurrentBooking: { statuses: responses.map((r) => r.status), sameSlotBookingsCreated: bookings.length }, suspendedAccount: { status: brandResponse.status, writeAccepted: suspendedWrite }, webhookRetry: { status: retry.status, processingAttempts, lostAfterInitialFailure: processingAttempts === 1 && retry.status === 200 } }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
