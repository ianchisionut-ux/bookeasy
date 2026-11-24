const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

async function main() {
  const calls = []
  let status = 200
  const mock = { default: { fetch: async (request, env, ctx) => {
    calls.push({ request, env, ctx })
    return new Response('{}', { status })
  } } }
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync('cloudflare-worker.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { exports, Headers, Request, Response, URL, require: () => mock })
  const worker = exports.default
  const pending = []
  const ctx = { waitUntil: promise => pending.push(promise) }
  const env = { APP_URL: 'https://bookeasy.ro', CRON_SECRET: 'test-only', ENABLE_CRON_TRIGGERS: 'true' }
  const billingCron = { cron: '0 3-7 * * *', scheduledTime: Date.UTC(2026, 10, 24, 5) }
  await worker.scheduled(billingCron, { ...env, ENABLE_CRON_TRIGGERS: 'false' }, ctx)
  await worker.scheduled(billingCron, { ...env, BOOKEASY_CLOUDFLARE_PREVIEW: 'true' }, ctx)
  await worker.scheduled({ cron: 'unknown' }, env, ctx)
  assert.equal(calls.length, 0)
  const routes = [
    ['*/5 * * * *', 0, 'billing-payments'],
    ['0 3-7 * * *', 3, 'launch-campaign'],
    ['0 3-7 * * *', 4, 'account-cleanup'],
    ['0 3-7 * * *', 5, 'billing'],
    ['0 3-7 * * *', 6, 'check-tokens'],
    ['0 3-7 * * *', 7, 'sync-google-reviews'],
  ]
  for (const [cron, utcHour, path] of routes) {
    await worker.scheduled({ cron, scheduledTime: Date.UTC(2026, 10, 24, utcHour) }, env, ctx)
    await pending.pop()
    const call = calls.at(-1)
    assert.equal(call.request.url, `https://bookeasy.ro/api/cron/${path}`)
    assert.equal(call.request.headers.get('Authorization'), 'Bearer test-only')
    assert.equal(call.env, env)
    assert.equal(call.ctx, ctx)
  }
  const productionConfig = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'))
  assert.deepEqual(productionConfig.triggers.crons, ['0 3-7 * * *'])
  const previewConfig = JSON.parse(fs.readFileSync('wrangler.preview.jsonc', 'utf8'))
  assert.equal(previewConfig.routes, undefined)
  assert.equal(previewConfig.triggers, undefined)
  const previewResponse = await worker.fetch(new Request('https://preview.example/'), previewConfig.vars, ctx)
  assert.equal(previewResponse.headers.get('X-Robots-Tag'), 'noindex, nofollow')

  status = 500
  await worker.scheduled(billingCron, env, ctx)
  await assert.rejects(pending.pop(), /HTTP 500/)
  console.log('PASS: internal cron dispatch, disabled gate, authorization and error propagation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
