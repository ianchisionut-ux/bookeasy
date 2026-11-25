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

function fixture() {
  const objects = new Map()
  const versions = []
  let blobReads = 0
  let blobDeletes = 0
  let blobWriteAttempted = false
  let failBlobDelete = false
  const bucket = {
    async head(key) { return objects.has(key) ? { size: objects.get(key).bytes.length } : null },
    async put(key, value, options = {}) {
      if (options.onlyIf?.get('If-None-Match') === '*' && objects.has(key)) return null
      const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(await value.arrayBuffer())
      objects.set(key, { bytes, contentType: options.httpMetadata?.contentType })
      return { size: bytes.length }
    },
    async get(key, options = {}) {
      const stored = objects.get(key)
      if (!stored) return null
      const range = options.range
      const bytes = range ? stored.bytes.subarray(range.offset, range.offset + range.length) : stored.bytes
      return {
        body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }),
        size: stored.bytes.length,
        httpEtag: '"r2-etag"',
        httpMetadata: { contentType: stored.contentType },
        writeHttpMetadata(headers) { if (stored.contentType) headers.set('Content-Type', stored.contentType) },
      }
    },
    async delete(key) { objects.delete(key) },
  }
  const blob = {
    async get(key, options = {}) {
      blobReads++
      const current = versions.filter(item => item.pathname === key).at(-1)
      if (!current) return null
      const range = options.headers?.Range
      let bytes = current.bytes
      let statusCode = 200
      const headers = new Headers()
      if (range) {
        const [, startText, endText] = /^bytes=(\d+)-(\d*)$/.exec(range) || []
        if (!startText || Number(startText) >= bytes.length) return { statusCode: 416, blob: { size: bytes.length }, headers }
        const start = Number(startText), end = endText ? Math.min(Number(endText), bytes.length - 1) : bytes.length - 1
        bytes = bytes.subarray(start, end + 1)
        statusCode = 206
        headers.set('content-range', `bytes ${start}-${end}/${current.bytes.length}`)
      }
      headers.set('content-length', String(bytes.length))
      return {
        statusCode, headers, blob: { etag: current.etag, contentType: current.contentType, size: current.bytes.length },
        stream: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }),
      }
    },
    async list({ prefix }) { return { blobs: versions.filter(item => item.pathname.startsWith(prefix)), hasMore: false } },
    async del(value, options = {}) {
      blobDeletes++
      if (failBlobDelete) throw new Error('Synthetic Blob deletion outage')
      const index = versions.findIndex(item => item.url === value || item.pathname === value)
      if (index >= 0) {
        if (options.ifMatch) assert.equal(versions[index].etag, options.ifMatch)
        versions.splice(index, 1)
      }
    },
    put() { blobWriteAttempted = true; throw Error('New files must never go to Blob') },
  }
  const storage = load('lib/r2-storage.ts', {
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { BOOKEASY_FILES: bucket } }) },
    '@vercel/blob': blob,
  })
  return { storage, objects, versions, bucket, get blobReads() { return blobReads }, get blobDeletes() { return blobDeletes }, get blobWriteAttempted() { return blobWriteAttempted }, set failBlobDelete(value) { failBlobDelete = value } }
}

async function testR2PrimaryAndLegacyFallback() {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const f = fixture()
    const key = 'public/businesses/demo/hero.jpg'
    const file = new File(['new image'], 'hero.jpg', { type: 'image/jpeg' })
    assert.equal(f.storage.r2StorageConfigured(), true)
    assert.equal(await f.storage.putR2File(key, file, { allowOverwrite: false }), key)
    assert.equal(f.blobWriteAttempted, false)
    assert.equal(f.blobReads, 0)
    assert.equal(await new Response((await f.storage.getR2File(key)).body).text(), 'new image')
    await assert.rejects(f.storage.putR2File(key, file, { allowOverwrite: false }), /există deja/)
    await f.bucket.delete(key)
    assert.equal(await f.storage.getR2File(key), null)

    process.env.BLOB_READ_WRITE_TOKEN = 'legacy-test-token'
    f.versions.push({ pathname: key, url: 'https://blob.invalid/1', etag: 'etag-1', bytes: Buffer.from('old image'), contentType: 'image/jpeg' })
    assert.equal(await new Response((await f.storage.getR2File(key)).body).text(), 'old image')
    const legacyRange = await f.storage.getR2File(key, { range: 'bytes=2-4' })
    assert.equal(legacyRange.contentRange, 'bytes 2-4/9')
    assert.equal(await new Response(legacyRange.body).text(), 'd i')
    assert.equal((await f.storage.getR2File(key, { includeLegacyBlob: false })), null)
    await assert.rejects(f.storage.putR2File(key, file, { allowOverwrite: false }), /stocarea veche/)
    await f.storage.putR2File(key, file)
    assert.equal(await new Response((await f.storage.getR2File(key)).body).text(), 'new image')
    assert.equal(f.blobWriteAttempted, false)
    const range = await f.storage.getR2File(key, { range: 'bytes=2-4' })
    assert.equal(range.contentRange, 'bytes 2-4/9')
    assert.equal(await new Response(range.body).text(), 'w i')
    await assert.rejects(f.storage.getR2File(key, { range: 'bytes=99-' }), error => error instanceof f.storage.StorageRangeError && error.size === 9)
    console.log('PASS R2 writes and reads, legacy Blob fallback, no overwrite, and ranged reads')
  } finally {
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken
  }
}

async function testTombstonesAndVerifiedDeletion() {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN
  process.env.BLOB_READ_WRITE_TOKEN = 'legacy-test-token'
  try {
    const f = fixture()
    const key = 'patients/demo/document.pdf'
    await f.storage.putR2File(key, new File(['private'], 'document.pdf'))
    f.versions.push(
      { pathname: key, url: 'https://blob.invalid/1', etag: 'etag-1', bytes: Buffer.from('old one') },
      { pathname: key, url: 'https://blob.invalid/2', etag: 'etag-2', bytes: Buffer.from('old two') },
    )
    f.failBlobDelete = true
    await assert.rejects(f.storage.deleteR2FileAndVerify(`r2://${key}`), /Synthetic Blob deletion outage/)
    assert.equal(await f.storage.getR2File(key), null)
    assert.equal(f.versions.length, 2)
    f.failBlobDelete = false
    assert.equal(await f.storage.deleteR2FileAndVerify(`r2://${key}`), true)
    assert.equal(f.versions.length, 0)
    assert.equal(f.objects.has(key), false)
    assert.equal(await f.storage.getR2File(key), null)
    assert.equal(f.storage.r2Key(`/api/storage/public/${key}`), key)
    assert.equal(await f.storage.deleteR2FileAndVerify('https://external.invalid/file'), false)
    assert.equal(f.blobDeletes >= 3, true)
    console.log('PASS deletion tombstone hides failed legacy deletes and verified deletion removes every version')
  } finally {
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken
  }
}

async function main() {
  await testR2PrimaryAndLegacyFallback()
  await testTombstonesAndVerifiedDeletion()
}

module.exports = main
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
