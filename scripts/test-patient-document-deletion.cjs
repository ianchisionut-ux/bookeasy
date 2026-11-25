const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks, navigator = global.navigator) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'navigator', code)(
    name => name in mocks ? mocks[name] : require(name), module, module.exports, navigator,
  )
  return module.exports
}

async function testDeleteRoute() {
  let authenticated = true
  let url = 'r2://patients/business-1/customer-1/file.pdf'
  let references = 0
  let rowExists = true
  let storageError = false
  let dbError = false
  let storageCalls = 0
  let dbDeletes = 0
  let countedAliases = []
  const tx = {
    $queryRaw: async () => rowExists ? [{ url }] : [],
    patientDocument: {
      count: async ({ where }) => { countedAliases = where.url.in; return references },
      deleteMany: async () => {
        if (dbError) throw new Error('Synthetic database outage')
        rowExists = false
        dbDeletes++
        return { count: 1 }
      },
    },
  }
  const route = load('app/api/business/patients/[id]/documents/[docId]/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/prisma': { prisma: { $transaction: callback => callback(tx) } },
    '@/lib/business-auth': { auth: async () => authenticated ? { businessId: 'business-1' } : null },
    '@/lib/r2-storage': {
      isLegacyPublicBlobUrl: value => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(value || ''),
      r2Key: value => value?.startsWith('r2://') ? value.slice(5) : value?.startsWith('/api/storage/public/') ? value.slice(20) : null,
      r2Url: key => 'r2://' + key,
      publicR2Url: key => '/api/storage/public/' + key,
      deleteR2FileAndVerify: async () => { storageCalls++; if (storageError) throw new Error('Synthetic storage outage'); return true },
    },
  })
  const params = { params: Promise.resolve({ id: 'customer-1', docId: 'document-1' }) }
  authenticated = false
  assert.equal((await route.DELETE({}, params)).status, 401)
  authenticated = true
  rowExists = false
  assert.equal((await route.DELETE({}, params)).status, 404)
  rowExists = true
  url = 'https://legacy.invalid/document.pdf'
  assert.equal((await route.DELETE({}, params)).status, 409)
  assert.equal(storageCalls, 0)
  assert.equal(dbDeletes, 0)
  url = 'https://legacy.public.blob.vercel-storage.com/patients/business-1/file.pdf'
  assert.equal((await route.DELETE({}, params)).status, 409)
  assert.equal(storageCalls, 0)
  assert.equal(dbDeletes, 0)
  url = 'r2://patients/business-1/customer-1/file.pdf'
  references = 1
  assert.equal((await route.DELETE({}, params)).status, 409)
  assert.deepEqual(countedAliases, [url, '/api/storage/public/patients/business-1/customer-1/file.pdf'])
  assert.equal(storageCalls, 0)
  references = 0
  url = '/api/storage/public/patients/business-1/customer-1/file.pdf'
  references = 1
  assert.equal((await route.DELETE({}, params)).status, 409)
  assert.deepEqual(countedAliases, [url, 'r2://patients/business-1/customer-1/file.pdf'])
  assert.equal(storageCalls, 0)
  url = 'r2://patients/business-1/customer-1/file.pdf'
  references = 0
  storageError = true
  assert.equal((await route.DELETE({}, params)).status, 503)
  assert.equal(dbDeletes, 0)
  assert.equal(rowExists, true)
  storageError = false
  dbError = true
  assert.equal((await route.DELETE({}, params)).status, 503)
  assert.equal(rowExists, true)
  dbError = false
  assert.equal((await route.DELETE({}, params)).status, 200)
  assert.equal(dbDeletes, 1)
  assert.equal(rowExists, false)
  console.log('PASS unauthorized, missing, unsupported, shared, storage failure, database retry, and success')
}

async function testPhotoDeleteRoute() {
  let storageError = true
  let heroUrl = 'r2://public/businesses/business-1/hero.jpg'
  let photoExists = true
  let heroUpdates = 0
  let photoDeletes = 0
  const route = load('app/api/business/photos/[id]/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/prisma': { prisma: {
      business: {
        findUnique: async () => ({ heroImageUrl: heroUrl }),
        update: async () => { heroUpdates++; heroUrl = null },
      },
      businessPhoto: {
        findUnique: async () => photoExists ? { id: 'photo-1', businessId: 'business-1', url: 'r2://public/businesses/business-1/photo.jpg' } : null,
        delete: async () => { photoDeletes++; photoExists = false },
      },
    } },
    '@/lib/business-auth': { auth: async () => ({ businessId: 'business-1' }) },
    '@/lib/r2-storage': { deleteR2File: async () => { if (storageError) throw Error('Synthetic storage outage'); return true } },
  })
  assert.equal((await route.DELETE({}, { params: Promise.resolve({ id: 'hero' }) })).status, 503)
  assert.equal(heroUpdates, 0)
  assert.equal((await route.DELETE({}, { params: Promise.resolve({ id: 'photo-1' }) })).status, 503)
  assert.equal(photoDeletes, 0)
  storageError = false
  assert.equal((await route.DELETE({}, { params: Promise.resolve({ id: 'hero' }) })).status, 200)
  assert.equal((await route.DELETE({}, { params: Promise.resolve({ id: 'photo-1' }) })).status, 200)
  assert.equal(heroUpdates, 1)
  assert.equal(photoDeletes, 1)
  console.log('PASS failed photo storage deletion preserves database references')
}

async function main() {
  await require('./test-r2-storage.cjs')()
  await testDeleteRoute()
  await testPhotoDeleteRoute()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
