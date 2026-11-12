const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const response = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } }
const admin = { auth: async () => ({ isSuperAdmin: true }) }
const paymentReset = { resetIpayPaymentFields: () => ({ billingIpayOrderId: null }) }

async function testSubtotalAndVat() {
  const business = {
    category: 'SALON', billingSuspendedAt: null, billingDueAt: new Date('2026-12-01T12:00:00Z'),
    billingInvoiceUrl: null, billingAmount: 121, billingSubtotal: 100, billingVatRate: 21, billingStatus: 'NEPLATIT',
  }
  let update
  const route = load('app/api/superadmin/businesses/[id]/route.ts', {
    'next/server': response,
    '@/lib/prisma': { prisma: {
      business: { findUnique: async () => business, update: async ({ data }) => { update = data } },
      launchEnrollment: { findUnique: async () => null },
    } },
    '@/lib/auth': admin,
    '@/lib/business-categories': { BUSINESS_CATEGORIES: ['SALON', 'CLINICA', 'FITNESS'] },
    '@/lib/billing-ipay': paymentReset,
  })
  const request = data => ({ json: async () => data })
  const params = { params: Promise.resolve({ id: 'business-1' }) }
  const changed = await route.PATCH(request({ billingSubtotal: 200, billingVatRate: 21 }), params)
  assert.equal(changed.status, 200)
  assert.equal(update.billingAmount, 242)
  assert.equal(update.billingSubtotal, 200)
  assert.equal(update.billingIpayOrderId, null)

  business.billingInvoiceUrl = 'signal:invoice-1'
  update = null
  const protectedInvoice = await route.PATCH(request({ billingSubtotal: 300, billingVatRate: 21 }), params)
  assert.equal(protectedInvoice.status, 409)
  assert.equal(update, null)
  console.log('PASS subtotal/VAT updates gross amount; issued invoice blocks amount changes')
}

async function testStandardToPro() {
  let update
  const business = {
    id: 'business-1', planName: 'Standard', billingStatus: 'PLATIT', billingAmount: 121,
    billingVatRate: 21, billingInvoiceUrl: null, billingSuspendedAt: null, onboardingDone: true,
  }
  const tx = {
    business: { findUnique: async () => business, update: async ({ data }) => { update = data } },
    launchEnrollment: { findUnique: async () => null },
    billingModeChange: { create: async () => ({}) },
  }
  const route = load('app/api/superadmin/businesses/[id]/billing-mode/route.ts', {
    'next/server': response,
    '@/lib/auth': admin,
    '@/lib/prisma': { prisma: { $transaction: callback => callback(tx) } },
    '@/lib/billing-ipay': paymentReset,
    '@/lib/plan-pricing': { getPlanPrices: async () => ({ standardMinor: 12100, proMinor: 24200 }) },
    '@/lib/promotion-campaigns': { promotionVersion: () => '', promotionIsOpen: () => true },
    '@/lib/launch-policy': { launchMonth: () => new Date() },
    '@/lib/launch-campaign': { lockLaunchBusiness: async () => {}, syncLaunchInTransaction: async () => {} },
  })
  const result = await route.POST({
    headers: new Headers({ origin: 'https://bookeasy.ro' }), nextUrl: { origin: 'https://bookeasy.ro' },
    json: async () => ({ mode: 'PRO' }),
  }, { params: Promise.resolve({ id: business.id }) })
  assert.equal(result.status, 200)
  assert.equal(update.planName, 'Pro')
  assert.equal(update.billingAmount, 242)
  assert.equal(update.billingStatus, 'NEPLATIT')
  assert(update.billingDueAt instanceof Date)
  assert.equal(update.billingPaidAt, null)

  business.billingInvoiceUrl = 'signal:standard-invoice'
  update = null
  const invoiceUpgrade = await route.POST({
    headers: new Headers({ origin: 'https://bookeasy.ro' }), nextUrl: { origin: 'https://bookeasy.ro' },
    json: async () => ({ mode: 'PRO' }),
  }, { params: Promise.resolve({ id: business.id }) })
  assert.equal(invoiceUpgrade.status, 200)
  assert.equal(update.planName, 'Pro')
  assert.equal(update.billingAmount, 242)
  console.log('PASS Standard to PRO applies PRO amount, due date, and unpaid status')
}

async function testPaidInvoiceGeneration() {
  const paidAt = new Date('2026-11-01T12:00:00Z')
  const business = {
    id: 'business-1', billingStatus: 'PLATIT', billingPaidAt: paidAt,
    billingSubtotal: 100, billingAmount: 121, billingDueAt: new Date('2026-12-01T12:00:00Z'),
    billingInvoiceUrl: null, billingInvoiceExternalId: 'existing-id',
    billingLegalName: 'Example SRL', billingAddress: 'Main Street', billingCounty: 'Salaj', billingCity: 'Zalau',
    billingClientType: 'PJ', billingCif: 'RO123456', billingVatRate: 21, billingCurrency: 'RON',
  }
  let update
  const tx = { business: { findUnique: async () => business }, launchEnrollment: { findUnique: async () => null } }
  const route = load('app/api/superadmin/businesses/[id]/invoice/generate/route.ts', {
    'next/server': response,
    '@/lib/auth': admin,
    '@/lib/prisma': { prisma: { $transaction: callback => callback(tx), business: { updateMany: async ({ data }) => { update = data } } } },
    '@/lib/rate-limit': { rateLimit: async () => ({ allowed: true }) },
    '@/lib/signal-billing': { createSignalInvoice: async () => ({ externalId: 'existing-id', reference: 'F-1', total: 121, duplicate: false }) },
    '@/lib/billing-ipay': paymentReset,
    '@/lib/launch-campaign': { lockLaunchBusiness: async () => {}, refreshLaunchIfDue: async () => {} },
  })
  const result = await route.POST({}, { params: Promise.resolve({ id: business.id }) })
  assert.equal(result.status, 200)
  assert.equal(update.billingStatus, undefined)
  assert.equal(update.billingPaidAt, undefined)
  assert.equal(update.billingAmount, 121)
  console.log('PASS issuing a Signal invoice preserves a previously recorded payment')
}

Promise.all([testSubtotalAndVat(), testStandardToPro(), testPaidInvoiceGeneration()])
  .catch(error => { console.error(error); process.exitCode = 1 })
