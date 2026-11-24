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

async function testStorageVersions() {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN
  process.env.BLOB_READ_WRITE_TOKEN = 'synthetic-test-token'
  try {
    const key = 'patients/business-1/customer-1/old-file.pdf'
    let versions = [
      { pathname: key, url: 'https://blob.invalid/version-1', etag: 'etag-1' },
      { pathname: key, url: 'https://blob.invalid/version-2', etag: 'etag-2' },
    ]
    let failAfter = -1
    const deleted = []
    const storage = load('lib/r2-storage.ts', {
      '@opennextjs/cloudflare': { getCloudflareContext: () => { throw new Error('Node should not read Worker bindings') } },
      '@vercel/blob': {
        list: async ({ prefix }) => ({ blobs: versions.filter(item => item.pathname.startsWith(prefix)), hasMore: false }),
        get: async () => versions.length ? { statusCode: 200, blob: versions.at(-1) } : null,
        del: async (url, { ifMatch }) => {
          if (failAfter === 0) throw new Error('Synthetic storage outage')
          if (failAfter > 0) failAfter--
          const item = versions.find(version => version.url === url || version.pathname === url)
          assert(item)
          assert.equal(ifMatch, item.etag)
          versions = versions.filter(version => version !== item)
          deleted.push(url)
        },
        put: async () => {},
      },
    })
    assert.equal(storage.r2Key('r2://' + key), key)
    assert.equal(storage.r2Key('/api/storage/public/' + key), key)
    failAfter = 1
    await assert.rejects(storage.deleteR2FileAndVerify('r2://' + key), /Synthetic storage outage/)
    assert.equal(versions.length, 1)
    failAfter = -1
    assert.equal(await storage.deleteR2FileAndVerify('/api/storage/public/' + key), true)
    assert.equal(versions.length, 0)
    assert.equal(deleted.length, 2)
    assert.equal(await storage.deleteR2FileAndVerify('r2://' + key), true)
    assert.equal(await storage.deleteR2FileAndVerify('https://legacy.invalid/file.pdf'), false)
    let fallbackExists = true
    let cancelled = false
    const fallbackStorage = load('lib/r2-storage.ts', {
      '@opennextjs/cloudflare': { getCloudflareContext: () => { throw new Error('Node should not read Worker bindings') } },
      '@vercel/blob': {
        list: async () => ({ blobs: [], hasMore: false }),
        get: async () => fallbackExists ? { statusCode: 200, blob: { etag: 'fallback-etag' }, stream: { cancel: async () => { cancelled = true } } } : null,
        del: async (_key, { ifMatch }) => { assert.equal(ifMatch, 'fallback-etag'); fallbackExists = false },
      },
    })
    assert.equal(await fallbackStorage.deleteR2FileAndVerify('r2://' + key), true)
    assert.equal(cancelled, true)
    console.log('PASS all exact Blob versions deleted; partial failure retries; fallback origin check; legacy URL is rejected')
  } finally {
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken
  }
}

async function testWorkerStorage() {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN
  process.env.BLOB_READ_WRITE_TOKEN = 'synthetic-test-token'
  try {
    const key = 'patients/business-1/customer-1/legacy.pdf'
    const blobStream = new ReadableStream()
    const blob = { statusCode: 200, stream: blobStream, blob: { etag: 'blob-etag', contentType: 'application/pdf' } }
    const r2Object = { body: new ReadableStream(), httpEtag: 'r2-etag' }
    let currentBlob = blob
    let currentR2 = r2Object
    let blobError = false
    let r2DeleteError = false
    let r2DeleteNoOp = false
    let r2Reads = 0
    let blobWrites = 0
    const blobCacheOptions = []
    const storage = load('lib/r2-storage.ts', {
      '@opennextjs/cloudflare': {
        getCloudflareContext: () => ({
          env: {
            BOOKEASY_FILES: {
              get: async pathname => { assert.equal(pathname, key); r2Reads++; return currentR2 },
              delete: async pathname => {
                assert.equal(pathname, key)
                if (r2DeleteError) throw new Error('Synthetic R2 outage')
                if (!r2DeleteNoOp) currentR2 = null
              },
              head: async pathname => { assert.equal(pathname, key); return currentR2 ? { etag: 'r2-etag' } : null },
            },
          },
        }),
      },
      '@vercel/blob': {
        get: async (_pathname, { useCache }) => {
          blobCacheOptions.push(useCache)
          if (blobError) throw new Error('Synthetic Blob outage')
          return currentBlob
        },
        list: async () => ({
          blobs: currentBlob ? [{ pathname: key, url: 'https://blob.invalid/file', etag: 'blob-etag' }] : [],
          hasMore: false,
        }),
        put: async () => { blobWrites++ },
        del: async () => { currentBlob = null },
      },
    }, { userAgent: 'Cloudflare-Workers' })

    await storage.putR2File(key, new File(['test'], 'test.pdf'))
    assert.equal(blobWrites, 1)
    assert.equal((await storage.getR2File(key)).body, blobStream)
    assert.equal(r2Reads, 0)
    blobError = true
    await assert.rejects(storage.getR2File(key), /Synthetic Blob outage/)
    assert.equal(r2Reads, 0)
    blobError = false
    currentBlob = null
    assert.equal(await storage.getR2File(key), r2Object)
    assert.equal(r2Reads, 1)
    assert.equal(await storage.getR2File(key, { includeLegacyR2: false }), null)
    assert.equal(r2Reads, 1)
    assert.deepEqual(blobCacheOptions, [false, false, false, undefined])

    currentBlob = blob
    r2DeleteError = true
    await assert.rejects(storage.deleteR2FileAndVerify('r2://' + key), /Synthetic R2 outage/)
    assert.equal(currentBlob, null)
    assert.equal(currentR2, r2Object)
    r2DeleteError = false
    r2DeleteNoOp = true
    await assert.rejects(storage.deleteR2FileAndVerify('r2://' + key), /există încă/)
    r2DeleteNoOp = false
    assert.equal(await storage.deleteR2FileAndVerify('r2://' + key), true)
    assert.equal(await storage.getR2File(key), null)
    console.log('PASS Worker keeps Blob writes, reads legacy R2 after Blob misses, and verifies both stores on deletion')
  } finally {
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken
  }
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

async function main() {
  await testStorageVersions()
  await testWorkerStorage()
  await testDeleteRoute()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
