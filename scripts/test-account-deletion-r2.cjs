const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(
    name => name in mocks ? mocks[name] : require(name), module, module.exports,
  )
  return module.exports
}

async function main() {
  const storage = load('lib/r2-storage.ts', {
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: {} }) },
  })
  const businessId = 'business-1'
  const queued = []
  let businessDeleted = false
  const noOpModel = new Proxy({}, { get: () => async () => ({ count: 0 }) })
  const models = {
    business: {
      findUnique: async () => ({ id: businessId, name: 'Salon',
        heroImageUrl: '/api/storage/public/public/business-1/hero.jpg' }),
      delete: async () => { businessDeleted = true },
    },
    user: {
      findUnique: async () => ({ id: 'owner-1', role: 'OWNER', businessId }),
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
    contractSignature: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    launchEnrollment: { findUnique: async () => null },
    subscription: { findUnique: async () => null, deleteMany: async () => ({ count: 0 }) },
    businessPhoto: {
      findMany: async () => [
        { url: '/api/storage/public/public/businesses/business-1/gallery.jpg' },
        { url: '/api/storage/public/public/business-10/unrelated.jpg' },
        { url: 'https://legacy.public.blob.vercel-storage.com/business-1/old.jpg' },
      ],
      deleteMany: async () => ({ count: 0 }),
    },
    patientDocument: {
      findMany: async () => [
        { url: 'r2://patients/business-1/patient/document.pdf' },
        { url: 'r2://patients/business-10/other/document.pdf' },
      ],
      deleteMany: async () => ({ count: 0 }),
    },
    practitioner: {
      findMany: async () => [{ photoUrl: 'r2://public/business-1/staff.jpg' }],
      deleteMany: async () => ({ count: 0 }),
    },
  }
  const tx = new Proxy({
    $queryRaw: async strings => strings[0].includes('AccountDeletionChallenge') ? [{ tokenHash: 'valid' }] : [],
    $executeRaw: async (strings, ...values) => {
      if (strings[0].includes('AccountFileDeletion')) queued.push(values.at(-1))
      return 1
    },
  }, { get: (target, name) => target[name] ?? models[name] ?? noOpModel })
  const prisma = { $transaction: async callback => callback(tx) }
  const { deleteAccount } = load('lib/account-deletion.ts', {
    stripe: class Stripe {},
    './prisma': { prisma },
    './client-profile': { clientIdentity: () => null },
    './session-revocation': { accountHash: value => value },
    './crypto': { encrypt: value => value },
    './r2-storage': storage,
  })

  await deleteAccount({ kind: 'BUSINESS', actorKey: 'user:owner-1', targetKey: 'business:business-1',
    confirmation: 'Salon', businessId, userId: 'owner-1' }, 'a'.repeat(64), 'Salon')

  assert.equal(businessDeleted, true)
  assert.deepEqual(queued.sort(), [
    '/api/storage/public/public/business-1/hero.jpg',
    '/api/storage/public/public/businesses/business-1/gallery.jpg',
    'r2://patients/business-1/patient/document.pdf',
    'r2://public/business-1/staff.jpg',
  ].sort())
  console.log('PASS account deletion queues current and historical business R2 objects only')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
