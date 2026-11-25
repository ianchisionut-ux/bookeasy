const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function loadStorage(bucket) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib/r2-storage.ts'), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name =>
    name === '@opennextjs/cloudflare'
      ? { getCloudflareContext: () => ({ env: { BOOKEASY_FILES: bucket } }) }
      : require(name), module, module.exports)
  return module.exports
}

function fixture() {
  const objects = new Map()
  let failDeleteKey = null
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
    async delete(key) {
      if (key === failDeleteKey) throw new Error('Synthetic R2 deletion outage')
      objects.delete(key)
    },
  }
  return { storage: loadStorage(bucket), objects, set failDeleteKey(key) { failDeleteKey = key } }
}

async function testR2OnlyReadsAndRanges() {
  const f = fixture()
  const key = 'public/businesses/demo/hero.jpg'
  const file = new File(['new image'], 'hero.jpg', { type: 'image/jpeg' })
  assert.equal(f.storage.r2StorageConfigured(), true)
  assert.equal(await f.storage.putR2File(key, file, { allowOverwrite: false }), key)
  assert.equal(await new Response((await f.storage.getR2File(key)).body).text(), 'new image')
  await assert.rejects(f.storage.putR2File(key, file, { allowOverwrite: false }), /există deja/)
  const range = await f.storage.getR2File(key, { range: 'bytes=2-4' })
  assert.equal(range.contentRange, 'bytes 2-4/9')
  assert.equal(range.contentLength, 3)
  assert.equal(await new Response(range.body).text(), 'w i')
  await assert.rejects(f.storage.getR2File(key, { range: 'bytes=99-' }),
    error => error instanceof f.storage.StorageRangeError && error.size === 9)
  assert.equal(f.storage.r2Key(f.storage.r2Url(key)), key)
  assert.equal(f.storage.r2Key(f.storage.publicR2Url(key)), key)
  assert.equal(f.storage.r2Key(`https://legacy.public.blob.vercel-storage.com/${key}`), null)
  assert.equal(f.storage.r2Key('https://external.invalid/file'), null)
  console.log('PASS R2-only writes, reads, no overwrite, ranged reads and URL parsing')
}

async function testTombstoneAndRetry() {
  const f = fixture()
  const key = 'patients/demo/document.pdf'
  const reference = f.storage.r2Url(key)
  await f.storage.putR2File(key, new File(['private'], 'document.pdf'))
  f.failDeleteKey = key
  await assert.rejects(f.storage.deleteR2FileAndVerify(reference), /Synthetic R2 deletion outage/)
  assert.equal(await f.storage.getR2File(key), null)
  assert.equal(f.objects.has(key), true)
  f.failDeleteKey = null
  assert.equal(await f.storage.deleteR2FileAndVerify(reference), true)
  assert.equal(f.objects.has(key), false)
  assert.equal(await f.storage.getR2File(key), null)
  assert.equal(await f.storage.deleteR2FileAndVerify('https://external.invalid/file'), false)
  await f.storage.putR2File(key, new File(['replacement'], 'document.pdf'))
  assert.equal(await new Response((await f.storage.getR2File(key)).body).text(), 'replacement')
  assert.equal(await f.storage.deleteR2File(reference), true)
  assert.equal(await f.storage.getR2File(key), null)
  console.log('PASS failed deletion stays unreadable, retry verifies removal, and reupload clears tombstone')
}

async function main() {
  await testR2OnlyReadsAndRanges()
  await testTombstoneAndRetry()
}

module.exports = main
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
