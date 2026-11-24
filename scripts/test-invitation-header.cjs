const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

async function main() {
  const images = load('lib/invitation-header-image.ts')
  const jpeg = fs.readFileSync(path.join(__dirname, '../public/email/bookeasy-invitation-header-wide.jpg'))
  assert.deepEqual(images.invitationHeaderJpegDimensions(jpeg), { width: 1800, height: 600 })
  assert.equal(images.invitationHeaderJpegDimensions(jpeg.subarray(0, -1)), null)
  assert.equal(images.invitationHeaderJpegDimensions(Buffer.concat([jpeg, Buffer.from('trailing data')])), null)

  let authorized = false
  let writes = 0
  const route = load('app/api/superadmin/invitations/header/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/admin-action': { adminAction: async () => authorized ? null : Response.json({}, { status: 403 }) },
    '@/lib/invitation-header-image': images,
    '@/lib/r2-storage': {
      putR2File: async (key, file) => {
        assert.match(key, /^public\/invitation-headers\/[0-9a-f-]+\.jpg$/)
        assert.equal(file.type, 'image/jpeg')
        assert.equal(file.size, jpeg.length)
        writes++
      },
      publicR2Url: key => '/api/storage/public/' + key,
    },
  })
  function request(bytes, type) {
    const form = new FormData()
    form.set('image', new File([bytes], 'image.jpg', { type }))
    return new Request('https://bookeasy.example/api/superadmin/invitations/header', { method: 'POST', body: form })
  }

  assert.equal((await route.POST(request(jpeg, 'image/jpeg'))).status, 403)
  authorized = true
  assert.equal((await route.POST(request(jpeg, 'image/png'))).status, 400)
  assert.equal((await route.POST(request(Buffer.from('text'), 'image/jpeg'))).status, 400)
  assert.equal((await route.POST(request(Buffer.alloc(images.INVITATION_HEADER_MAX_BYTES + 4096), 'image/jpeg'))).status, 413)

  const oversizedDimensions = Buffer.from(jpeg)
  const frame = oversizedDimensions.indexOf(Buffer.from([0xff, 0xc2]))
  assert.ok(frame > 0)
  oversizedDimensions.writeUInt16BE(1801, frame + 7)
  assert.deepEqual(images.invitationHeaderJpegDimensions(oversizedDimensions), { width: 1801, height: 600 })
  assert.equal((await route.POST(request(oversizedDimensions, 'image/jpeg'))).status, 400)
  assert.equal(writes, 0)

  const response = await route.POST(request(jpeg, 'image/jpeg'))
  assert.equal(response.status, 200)
  assert.match((await response.json()).url, /\/api\/storage\/public\/public\/invitation-headers\/.*\.jpg$/)
  assert.equal(writes, 1)
  console.log('PASS invite header upload authorization, byte limit, JPEG validation, dimensions, and storage')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
