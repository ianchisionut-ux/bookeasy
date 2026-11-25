const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')

let session = { businessId: 'business-1', role: 'OWNER', user: { email: 'owner@example.test' } }
let configured = true
let registrationError = null
let bankRegistrations = 0
let business = fixture()
let period = null

function fixture() {
  return {
    id: 'business-1', billingStatus: 'NEPLATIT', billingInvoiceUrl: 'signal:invoice-1',
    billingInvoiceName: 'BE-1.pdf', billingInvoiceExternalId: 'invoice-1',
    billingInvoiceUploadedAt: null, billingAmount: 119, billingCurrency: 'RON',
    billingIpayOrderId: null, billingIpayOrderNumber: null, billingIpayPaymentState: null,
  }
}

function matches(where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'billingStatus' && value?.in) return value.in.includes(business.billingStatus)
    return business[key] === value
  })
}

const prisma = {
  $transaction: async callback => callback(prisma),
  business: {
    findUnique: async () => ({ ...business }),
    updateMany: async ({ where, data }) => {
      if (!matches(where)) return { count: 0 }
      Object.assign(business, data)
      return { count: 1 }
    },
  },
  launchEnrollment: { findUnique: async () => period && { id: 'enrollment-1', billingCycle: 1, cancelledAt: null } },
  launchBillingPeriod: { findUnique: async () => period },
}
const mocks = {
  '@/lib/auth': { auth: async () => session },
  '@/lib/prisma': { prisma },
  '@/lib/rate-limit': { rateLimit: async () => ({ allowed: true }) },
  '@/lib/launch-campaign': { refreshLaunchIfDue: async () => {}, lockLaunchBusiness: async () => {} },
  '@/lib/payments/ipay': { IPAY_RON_CURRENCY: 946 },
  '@/lib/billing-ipay': {
    isPlatformIpayConfigured: () => configured,
    validateIpayInvoice: row => {
      if (row.billingStatus !== 'NEPLATIT') throw new Error('Factura nu este disponibilă pentru plată.')
      return { amountMinor: 11900, invoiceReference: 'invoice-1' }
    },
    newIpayOrderNumber: () => 'BE-test-order',
    createIpayInvoiceCheckout: async () => {
      bankRegistrations++
      if (registrationError) throw registrationError
      return { orderId: '11111111-2222-3333-4444-555555555555', paymentUrl: 'https://ecclients-sandbox.btrl.ro/payment/test' }
    },
  },
}
const moduleRef = { exports: {} }
const source = fs.readFileSync(path.join(__dirname, '../app/api/billing/checkout/route.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), moduleRef, moduleRef.exports)
const { POST } = moduleRef.exports
const request = (origin = 'https://bookeasy.ro') => new NextRequest('https://bookeasy.ro/api/billing/checkout', { method: 'POST', headers: { origin } })

async function main() {
  session = { businessId: 'business-1', role: 'STAFF', user: { email: 'staff@example.test' } }
  assert.equal((await POST(request())).status, 403)
  session = { businessId: 'business-1', role: 'OWNER', user: { email: 'owner@example.test' } }
  assert.equal((await POST(request('https://attacker.example'))).status, 403)
  configured = false
  assert.equal((await POST(request())).status, 503)
  configured = true
  assert.equal(bankRegistrations, 0)

  period = { amountMinor: 12000, invoiceUrl: business.billingInvoiceUrl, paidAt: null }
  assert.equal((await POST(request())).status, 409)
  assert.equal(bankRegistrations, 0)
  period = null

  const first = await POST(request())
  assert.equal(first.status, 200)
  assert.equal((await first.json()).paymentUrl, 'https://ecclients-sandbox.btrl.ro/payment/test')
  assert.equal(business.billingIpayPaymentState, 'REGISTERED')
  assert.equal(bankRegistrations, 1)
  assert.equal((await POST(request())).status, 409)
  assert.equal(bankRegistrations, 1)

  business = fixture()
  registrationError = new Error('Timeout')
  assert.equal((await POST(request())).status, 502)
  assert.equal(business.billingIpayPaymentState, 'REVIEW_REQUIRED')
  assert.equal((await POST(request())).status, 409)
  assert.equal(bankRegistrations, 2)

  business = { ...fixture(), billingStatus: 'PLATIT' }
  registrationError = null
  assert.equal((await POST(request())).status, 409)
  assert.equal(bankRegistrations, 2)
  console.log('PASS: owner-only invoice checkout, same-origin, feature gate, campaign amount, idempotency and ambiguous bank response')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
