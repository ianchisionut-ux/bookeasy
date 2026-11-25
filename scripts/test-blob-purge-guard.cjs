const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const ts = require('typescript')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const jsonResponse = { json: (body, options) => ({ body, status: options?.status ?? 200 }) }
const stream = bytes => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } })
const request = body => ({ headers: { get: name => name === 'origin' ? 'https://bookeasy.ro' : null },
  nextUrl: { origin: 'https://bookeasy.ro' }, json: async () => body })
const privateHost = 'xwrhrpurrcw8v50w.private.blob.vercel-storage.com'

async function testPrivatePurge() {
  const prior = Object.fromEntries(['STORAGE_MIGRATION_ENABLED', 'STORAGE_BLOB_PURGE_ENABLED',
    'STORAGE_BLOB_PURGE_EXPECTED_HOST', 'BLOB_READ_WRITE_TOKEN']
    .map(key => [key, process.env[key]]))
  process.env.STORAGE_MIGRATION_ENABLED = 'true'
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_xwrhrpurrcw8v50w_test-secret'
  process.env.STORAGE_BLOB_PURGE_EXPECTED_HOST = privateHost
  delete process.env.STORAGE_BLOB_PURGE_ENABLED
  const old = new Map()
  const r2 = new Map()
  for (let i = 1; i <= 3; i++) {
    const pathname = `patients/business-${i}/document-${i}.pdf`
    const bytes = Buffer.from(`confidential-${i}`)
    old.set(pathname, { pathname, bytes, url: `https://${privateHost}/${pathname}`,
      etag: `"etag-${i}"`, size: bytes.length, contentType: 'application/pdf' })
    r2.set(pathname, { bytes: Buffer.from(bytes), contentType: 'application/pdf' })
  }
  let authorized = true
  let refs = 0
  let deletes = 0
  const route = load('app/api/superadmin/storage-migration/purge/route.ts', {
    '@vercel/blob': {
      list: async ({ limit, cursor }) => {
        const items = [...old.values()].sort((a, b) => a.pathname.localeCompare(b.pathname))
          .filter(item => !cursor || item.pathname > cursor)
        const page = items.slice(0, limit)
        return { blobs: page.map(({ pathname, url, etag, size }) => ({ pathname, url, etag, size })),
          hasMore: items.length > limit, cursor: items.length > limit ? page.at(-1).pathname : undefined }
      },
      get: async pathname => {
        const item = old.get(pathname)
        return item ? { statusCode: 200, blob: { ...item }, stream: stream(item.bytes) } : null
      },
      del: async (url, { token, ifMatch }) => {
        assert.equal(token, 'vercel_blob_rw_xwrhrpurrcw8v50w_test-secret')
        const item = [...old.values()].find(value => value.url === url)
        assert.ok(item)
        assert.equal(ifMatch, item.etag)
        deletes++
        old.delete(item.pathname)
      },
    },
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { BOOKEASY_FILES: {
      head: async key => r2.has(key) ? { size: r2.get(key).bytes.length, httpMetadata: { contentType: r2.get(key).contentType } } : null,
      get: async key => r2.has(key) ? { size: r2.get(key).bytes.length, body: stream(r2.get(key).bytes) } : null,
    } } }) },
    'next/server': { NextResponse: jsonResponse },
    '@/lib/auth': { auth: async () => authorized ? { isSuperAdmin: true } : null },
    '@/lib/storage-legacy-audit': { countStorageReferences: async () => refs },
  })
  try {
    authorized = false
    assert.equal((await route.POST(request({ mode: 'dry-run' }))).status, 401)
    authorized = true
    refs = 1
    const refResponse = await route.POST(request({ mode: 'dry-run' }))
    assert.equal(refResponse.body.error, 'database_references_present')
    assert.equal(deletes, 0)
    refs = 0
    const first = await route.POST(request({ mode: 'dry-run', limit: 2 }))
    assert.equal(first.status, 200)
    assert.equal(first.body.verified, 2)
    assert.equal(first.body.hasMore, true)
    const second = await route.POST(request({ mode: 'dry-run', limit: 2, cursor: first.body.nextCursor }))
    assert.equal(second.body.verified, 1)
    assert.equal(second.body.hasMore, false)
    let proofs = [...first.body.proofs, ...second.body.proofs]
    assert.equal(proofs.length, 3)
    for (const proof of proofs) {
      const decoded = Buffer.from(proof.split('.')[0], 'base64url').toString('utf8')
      assert.equal(decoded.includes('.private.blob.vercel-storage.com'), false)
      assert.equal(decoded.includes('patients/'), false)
    }
    const disabled = await route.POST(request({ mode: 'purge', proofs }))
    assert.equal(disabled.body.error, 'purge_disabled')
    assert.equal(deletes, 0)

    process.env.STORAGE_BLOB_PURGE_ENABLED = 'true'
    const altered = old.get('patients/business-1/document-1.pdf')
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_anotherstore_test-secret'
    assert.equal((await route.POST(request({ mode: 'purge', proofs }))).body.error, 'expected_store_not_configured')
    assert.equal(deletes, 0)
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_xwrhrpurrcw8v50w_test-secret'
    process.env.STORAGE_BLOB_PURGE_EXPECTED_HOST = 'another.private.blob.vercel-storage.com'
    assert.equal((await route.POST(request({ mode: 'purge', proofs }))).body.error, 'expected_store_not_configured')
    assert.equal(deletes, 0)
    process.env.STORAGE_BLOB_PURGE_EXPECTED_HOST = privateHost
    const extraPath = 'patients/business-extra/document-extra.pdf'
    const extraBytes = Buffer.from('extra-file')
    old.set(extraPath, { pathname: extraPath, bytes: extraBytes,
      url: `https://${privateHost}/${extraPath}`,
      etag: '"extra-etag"', size: extraBytes.length, contentType: 'application/pdf' })
    r2.set(extraPath, { bytes: extraBytes, contentType: 'application/pdf' })
    assert.equal((await route.POST(request({ mode: 'purge', proofs }))).body.error, 'inventory_changed')
    assert.equal(deletes, 0)
    old.delete(extraPath)
    r2.delete(extraPath)
    altered.etag = '"changed"'
    assert.equal((await route.POST(request({ mode: 'purge', proofs }))).body.error, 'inventory_changed')
    assert.equal(deletes, 0)
    altered.etag = '"etag-1"'
    r2.get(altered.pathname).bytes = Buffer.from('confidential-X')
    assert.equal((await route.POST(request({ mode: 'purge', proofs }))).body.error, 'destination_hash_mismatch')
    assert.equal(deletes, 0)
    r2.get(altered.pathname).bytes = Buffer.from(altered.bytes)
    const tombstone = `_deleted/${createHash('sha256').update(altered.pathname).digest('hex')}`
    r2.set(tombstone, { bytes: Buffer.from(''), contentType: 'application/octet-stream' })
    assert.equal((await route.POST(request({ mode: 'purge', proofs }))).body.error, 'destination_marked_deleted')
    assert.equal(deletes, 0)
    r2.delete(tombstone)

    while (proofs.length) {
      const result = await route.POST(request({ mode: 'purge', proofs }))
      assert.equal(result.status, 200)
      assert.equal(result.body.purged, 1)
      proofs = proofs.filter(proof => proof !== result.body.processedProof)
      assert.equal(result.body.remaining, proofs.length)
    }
    assert.equal(old.size, 0)
    assert.equal(deletes, 3)
    assert.equal(r2.size, 3)
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function testPublicArchive() {
  const previous = process.env.STORAGE_MIGRATION_ENABLED
  const previousFetch = global.fetch
  process.env.STORAGE_MIGRATION_ENABLED = 'true'
  const bytes = Buffer.from('synthetic-public-jpeg')
  const digest = createHash('sha256').update(bytes).digest('hex')
  const canonicalKey = `public/cmsiyc6ke0000l204tc0x10m3/migrated-cover-${digest}.jpg`
  const r2 = new Map()
  let writes = 0
  const bucket = {
    head: async key => r2.has(key) ? { size: r2.get(key).bytes.length, httpMetadata: { contentType: r2.get(key).contentType } } : null,
    get: async key => r2.has(key) ? { size: r2.get(key).bytes.length, body: stream(r2.get(key).bytes) } : null,
    put: async (key, data, options) => {
      assert.equal(key, canonicalKey)
      assert.equal(options.onlyIf.get('If-None-Match'), '*')
      writes++
      if (r2.has(key)) return null
      r2.set(key, { bytes: Buffer.from(data), contentType: options.httpMetadata.contentType })
      return { size: data.byteLength }
    },
  }
  let etag = '"316c1de9394d906b823d4422be140de3"'
  global.fetch = async () => new Response(bytes, { status: 200, headers: {
    etag, 'content-type': 'image/jpeg', 'content-length': String(bytes.length),
  } })
  const route = load('app/api/superadmin/storage-migration/public-archive/route.ts', {
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { BOOKEASY_FILES: bucket } }) },
    'next/server': { NextResponse: jsonResponse },
    '@/lib/auth': { auth: async () => ({ isSuperAdmin: true }) },
    '@/lib/storage-legacy-audit': { countStorageReferences: async () => 0 },
  })
  try {
    let result = await route.POST(request({ mode: 'dry-run' }))
    assert.equal(result.status, 200)
    assert.equal(result.body.copyNeeded, true)
    assert.equal(writes, 0)
    result = await route.POST(request({ mode: 'copy' }))
    assert.equal(result.status, 200)
    assert.equal(result.body.r2Verified, true)
    assert.equal(writes, 1)
    result = await route.POST(request({ mode: 'dry-run' }))
    assert.equal(result.body.r2Verified, true)
    assert.equal(writes, 1)
    r2.get(canonicalKey).bytes = Buffer.from('synthetic-public-JPEG')
    result = await route.POST(request({ mode: 'copy' }))
    assert.equal(result.body.error, 'destination_changed')
    assert.equal(writes, 1)
    etag = '"unexpected"'
    result = await route.POST(request({ mode: 'dry-run' }))
    assert.equal(result.body.error, 'source_changed')
  } finally {
    global.fetch = previousFetch
    if (previous === undefined) delete process.env.STORAGE_MIGRATION_ENABLED
    else process.env.STORAGE_MIGRATION_ENABLED = previous
  }
}

Promise.resolve().then(testPrivatePurge).then(testPublicArchive)
  .then(() => console.log('PASS private purge guards and public R2 archive verification'))
  .catch(error => { console.error(error); process.exitCode = 1 })
