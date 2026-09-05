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
  vm.runInNewContext(code, { exports, Request, require: () => mock })
  const worker = exports.default
  const pending = []
  const ctx = { waitUntil: promise => pending.push(promise) }
  const env = { APP_URL: 'https://bookeasy.ro', CRON_SECRET: 'test-only', ENABLE_CRON_TRIGGERS: 'true' }
  await worker.scheduled({ cron: '0 5 * * *' }, { ...env, ENABLE_CRON_TRIGGERS: 'false' }, ctx)
  await worker.scheduled({ cron: 'unknown' }, env, ctx)
  assert.equal(calls.length, 0)
  for (const [cron, path] of [['0 5 * * *', 'billing'], ['0 6 * * *', 'check-tokens'], ['0 7 * * *', 'sync-google-reviews']]) {
    await worker.scheduled({ cron }, env, ctx)
    await pending.pop()
    const call = calls.at(-1)
    assert.equal(call.request.url, `https://bookeasy.ro/api/cron/${path}`)
    assert.equal(call.request.headers.get('Authorization'), 'Bearer test-only')
    assert.equal(call.env, env)
    assert.equal(call.ctx, ctx)
  }
  status = 500
  await worker.scheduled({ cron: '0 5 * * *' }, env, ctx)
  await assert.rejects(pending.pop(), /HTTP 500/)
  console.log('PASS: internal cron dispatch, disabled gate, authorization and error propagation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
