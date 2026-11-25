const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const origin = 'https://bookeasy.ro'
const key = 'tutorials/11111111-1111-4111-8111-111111111111/video.mp4'
const captionsKey = 'tutorials/11111111-1111-4111-8111-111111111111/captions.vtt'

async function main() {
  let isSuperAdmin = true
  const objects = new Map()
  const uploads = new Map()
  const bucket = {
    async head(name) { return objects.has(name) ? { size: objects.get(name).length } : null },
    async put(name, body, options) {
      if (options.onlyIf?.get('If-None-Match') === '*' && objects.has(name)) return null
      objects.set(name, Buffer.from(await body.arrayBuffer()))
      return { size: objects.get(name).length }
    },
    async delete(name) { objects.delete(name) },
    createMultipartUpload(name) {
      const uploadId = 'upload-1'
      const parts = new Map()
      const upload = {
        uploadId,
        async uploadPart(partNumber, body) {
          const bytes = Buffer.from(await body.arrayBuffer())
          parts.set(partNumber, bytes)
          return { partNumber, etag: `etag-${partNumber}` }
        },
        async complete(received) {
          assert.deepEqual(received.map(item => item.partNumber), [...parts.keys()])
          const bytes = Buffer.concat([...parts.values()])
          objects.set(name, bytes)
          return { size: bytes.length }
        },
        async abort() { uploads.delete(uploadId) },
      }
      uploads.set(uploadId, upload)
      return upload
    },
    resumeMultipartUpload(_name, uploadId) {
      const upload = uploads.get(uploadId)
      assert(upload)
      return upload
    },
  }
  const uploadRoute = load('app/api/superadmin/tutorial-upload/route.ts', {
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { BOOKEASY_FILES: bucket } }) },
    '@/lib/auth': { auth: async () => ({ isSuperAdmin }) },
  })
  const request = (pathname, method, body, contentType = 'application/json', requestOrigin = origin) => new NextRequest(origin + pathname, {
    method, headers: { Origin: requestOrigin, 'Content-Type': contentType }, body,
  })
  const json = (value) => JSON.stringify(value)

  isSuperAdmin = false
  assert.equal((await uploadRoute.POST(request('/api/superadmin/tutorial-upload', 'POST', json({ action: 'create', key, size: 3 })))).status, 401)
  isSuperAdmin = true
  assert.equal((await uploadRoute.POST(request('/api/superadmin/tutorial-upload', 'POST', json({ action: 'create', key, size: 3 }), 'application/json', 'https://evil.invalid'))).status, 401)
  assert.equal((await uploadRoute.POST(request('/api/superadmin/tutorial-upload', 'POST', json({ action: 'create', key: 'patients/other', size: 3 })))).status, 400)

  const created = await uploadRoute.POST(request('/api/superadmin/tutorial-upload', 'POST', json({ action: 'create', key, size: 3 })))
  assert.equal(created.status, 200)
  const { uploadId } = await created.json()
  const part = await uploadRoute.PUT(request(`/api/superadmin/tutorial-upload?key=${encodeURIComponent(key)}&uploadId=${uploadId}&partNumber=1`, 'PUT', 'abc', 'video/mp4'))
  assert.equal(part.status, 200)
  const uploaded = await part.json()
  assert.equal((await uploadRoute.POST(request('/api/superadmin/tutorial-upload', 'POST', json({ action: 'complete', key, uploadId, parts: [{ partNumber: 2, etag: uploaded.etag }] })))).status, 400)
  const completed = await uploadRoute.POST(request('/api/superadmin/tutorial-upload', 'POST', json({ action: 'complete', key, uploadId, parts: [uploaded] })))
  assert.equal(completed.status, 200)
  assert.equal((await completed.json()).pathname, key)
  assert.equal(objects.get(key).toString(), 'abc')

  const captions = await uploadRoute.PUT(request(`/api/superadmin/tutorial-upload?key=${encodeURIComponent(captionsKey)}`, 'PUT', 'WEBVTT', 'text/vtt'))
  assert.equal(captions.status, 200)
  assert.equal(objects.get(captionsKey).toString(), 'WEBVTT')
  assert.equal((await uploadRoute.PUT(request(`/api/superadmin/tutorial-upload?key=${encodeURIComponent(captionsKey)}`, 'PUT', 'WEBVTT', 'text/vtt'))).status, 409)

  class StorageRangeError extends Error { constructor(size) { super('range'); this.size = size } }
  let authenticated = true
  let published = true
  const mediaRoute = load('app/api/tutorials/media/[...path]/route.ts', {
    '@/lib/auth': { auth: async () => authenticated ? { businessId: 'business-1' } : null },
    '@/lib/prisma': { prisma: { $queryRaw: async () => published ? [{ id: 'tutorial-1' }] : [] } },
    '@/lib/r2-storage': {
      StorageRangeError,
      getR2File: async (_path, options) => {
        if (options?.range === 'bytes=99-') throw new StorageRangeError(3)
        return {
          body: new ReadableStream({ start(controller) { controller.enqueue(Buffer.from(options?.range ? 'b' : 'abc')); controller.close() } }),
          contentRange: options?.range ? 'bytes 1-1/3' : undefined,
          contentLength: options?.range ? 1 : 3,
        }
      },
    },
  })
  const params = { params: Promise.resolve({ path: key.split('/') }) }
  authenticated = false
  assert.equal((await mediaRoute.GET(request('/api/tutorials/media/' + key, 'GET'), params)).status, 401)
  authenticated = true
  published = false
  assert.equal((await mediaRoute.GET(request('/api/tutorials/media/' + key, 'GET'), params)).status, 404)
  published = true
  const ranged = await mediaRoute.GET(new NextRequest(origin + '/api/tutorials/media/' + key, { headers: { Range: 'bytes=1-1' } }), params)
  assert.equal(ranged.status, 206)
  assert.equal(ranged.headers.get('Content-Range'), 'bytes 1-1/3')
  assert.equal(await ranged.text(), 'b')
  const unsatisfiable = await mediaRoute.GET(new NextRequest(origin + '/api/tutorials/media/' + key, { headers: { Range: 'bytes=99-' } }), params)
  assert.equal(unsatisfiable.status, 416)
  assert.equal(unsatisfiable.headers.get('Content-Range'), 'bytes */3')
  console.log('PASS R2 tutorial multipart upload, captions, auth/origin, no-overwrite, and private ranged media')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
