const assert = require('node:assert/strict')
const { generateKeyPairSync } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')

function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(
    name => name in mocks ? mocks[name] : require(name), module, module.exports,
  )
  return module.exports
}

async function main() {
  const eligibility = load('lib/wallet-eligibility.ts')
  const wallet = load('lib/google-wallet.ts', {
    './wallet-eligibility': eligibility,
    './business-plans': load('lib/business-plans.ts'),
    '@vercel/oidc': { getVercelOidcToken() { throw new Error('No provider call expected') } },
  })
  const route = load('app/api/business/wallet/check-in/route.ts', {
    '@/lib/google-wallet': wallet,
    '@/lib/wallet-eligibility': eligibility,
    '@/lib/business-auth': { auth: async () => ({ businessId: 'fixture-venue' }) },
    '@/lib/prisma': { prisma: { booking: { findFirst() { throw new Error('No database read expected') } } } },
  })

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  Object.assign(process.env, {
    GOOGLE_WALLET_ENABLED: 'true',
    GOOGLE_WALLET_ISSUER_ID: '1234',
    GOOGLE_WALLET_CLASS_ID: '1234.booking',
    GOOGLE_WALLET_QR_SECRET: 'fixture-secret-that-is-only-used-in-tests',
    GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: '',
    GOOGLE_WALLET_WIF_AUDIENCE: '',
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'fixture@example.invalid', private_key: privateKey }),
  })
  const origin = 'https://bookeasy.ro'
  const booking = {
    id: 'fixture-booking', startAt: new Date('2027-01-01T12:00:00Z'), serviceName: 'Rezervare',
    business: { id: 'fixture-venue', name: 'Sală', category: 'EVENT_VENUE', planName: 'PRO', billingStatus: 'ACHITAT' },
  }

  delete process.env.GOOGLE_WALLET_PUBLISHING_APPROVED
  assert.equal(wallet.walletConfigured(), true)
  assert.equal(wallet.walletAvailable(), false)
  assert.equal(await wallet.createBookingWalletLink(booking, origin), null)
  const response = await route.POST(new NextRequest(origin + '/api/business/wallet/check-in', {
    method: 'POST', headers: { origin }, body: JSON.stringify({ code: 'fixture' }),
  }))
  assert.equal(response.status, 404)

  process.env.GOOGLE_WALLET_PUBLISHING_APPROVED = 'true'
  assert.ok(wallet.walletAvailable())
  const link = await wallet.createBookingWalletLink(booking, origin)
  assert.ok(link?.startsWith('https://pay.google.com/gp/v/save/'))
  const [ , payload ] = link.split('/').at(-1).split('.')
  const barcode = JSON.parse(Buffer.from(payload, 'base64url')).payload.genericObjects[0].barcode.value
  const code = new URL(barcode).searchParams.get('code')
  assert.equal(wallet.verifyWalletQr(code, booking.business.id), booking.id)
  for (const category of ['SALON', 'COAFURA_FRIZERIE', 'BARBER_SHOP', 'NAILS', 'CLINICA']) {
    assert.equal(await wallet.createBookingWalletLink({ ...booking, business: { ...booking.business, category } }, origin), null)
  }
  assert.equal(await wallet.createBookingWalletLink({ ...booking, business: { ...booking.business, planName: 'STANDARD' } }, origin), null)
  process.env.GOOGLE_WALLET_PUBLISHING_APPROVED = 'false'
  assert.equal(wallet.verifyWalletQr(code, booking.business.id), null)
  console.log('PASS: configured Wallet stays hidden without publishing approval, existing QR links are disabled, and only eligible PRO profiles can issue passes.')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
