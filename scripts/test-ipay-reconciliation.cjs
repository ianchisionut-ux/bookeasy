const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

let business
let period
let enrollment
let periodUpdateFails = false

function fixture() {
  return {
    id: 'business-1', billingStatus: 'NEPLATIT', billingAmount: 119,
    billingCurrency: 'RON', billingInvoiceExternalId: 'invoice-1',
    billingInvoiceUrl: 'signal:invoice-1', billingIpayInvoiceReference: 'invoice-1',
    billingIpayOrderId: '11111111-2222-3333-4444-555555555555',
    billingIpayOrderNumber: 'BE-test-order', billingIpayAmountMinor: 11900,
    billingIpayCurrency: 946, billingIpayPaymentState: 'REGISTERED',
    billingSuspendedAt: null,
  }
}

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'billingStatus' && value?.in) return value.in.includes(row.billingStatus)
    return row[key] === value
  })
}

const tx = {
  business: {
    updateMany: async ({ where, data }) => {
      if (!matches(business, where)) return { count: 0 }
      Object.assign(business, data)
      return { count: 1 }
    },
  },
  launchEnrollment: { findUnique: async () => enrollment },
  launchBillingPeriod: {
    findUnique: async () => period,
    updateMany: async ({ where, data }) => {
      if (!period || periodUpdateFails || !matches(period, where)) return { count: 0 }
      Object.assign(period, data)
      return { count: 1 }
    },
    count: async () => 0,
  },
}
const prisma = {
  $transaction: async callback => {
    const beforeBusiness = structuredClone(business)
    const beforePeriod = structuredClone(period)
    try { return await callback(tx) } catch (error) {
      business = beforeBusiness
      period = beforePeriod
      throw error
    }
  },
  business: { findUnique: async () => business },
}
const mocks = {
  '@/lib/prisma': { prisma },
  '@/lib/billing-invoice': { amountToMinorUnits: amount => Math.round(amount * 100), getInvoiceReference: row => row.billingInvoiceExternalId },
  '@/lib/billing-ipay': {
    getIpayInvoiceStatus: async () => ({ orderStatus: 2 }),
    isIpayInvoiceConfirmed: () => true,
    isIpayInvoiceTerminalFailure: () => false,
    canReconcilePlatformIpay: () => true,
  },
  '@/lib/launch-campaign': { lockLaunchBusiness: async () => {} },
}
const moduleRef = { exports: {} }
const source = fs.readFileSync(path.join(__dirname, '../lib/billing-ipay-reconciliation.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), moduleRef, moduleRef.exports)
const { reconcileIpayBusiness } = moduleRef.exports

async function main() {
  business = fixture()
  enrollment = { id: 'enrollment-1', billingCycle: 1, cancelledAt: null }
  period = { id: 'period-1', invoiceUrl: 'signal:other-invoice', amountMinor: 11900, paidAt: null }
  assert.equal(await reconcileIpayBusiness(business), 'stale')
  assert.equal(business.billingStatus, 'NEPLATIT')

  period.invoiceUrl = business.billingInvoiceUrl
  periodUpdateFails = true
  await assert.rejects(() => reconcileIpayBusiness(business), /Perioada campaniei s-a modificat/)
  assert.equal(business.billingStatus, 'NEPLATIT')
  periodUpdateFails = false

  assert.equal(await reconcileIpayBusiness(business), 'confirmed')
  assert.equal(business.billingStatus, 'PLATIT')
  assert.equal(business.billingIpayPaymentState, 'DEPOSITED')
  assert.ok(period.paidAt instanceof Date)
  assert.equal(await reconcileIpayBusiness(business), 'confirmed')
  console.log('PASS: campaign invoice mismatch, atomic rollback and confirmed deposit')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
