const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const assert = require('node:assert/strict')

async function main() {
  const events = {}
  const deleted = []
  let claimed = false
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, Response,
    self: {
      location: { origin: 'https://www.bookeasy.ro' },
      addEventListener: (name, callback) => { events[name] = callback },
      skipWaiting: async () => {},
      clients: { claim: async () => { claimed = true } },
    },
    caches: {
      keys: async () => ['bookeasy-pwa-v1-static', 'unrelated-cache'],
      delete: async (key) => { deleted.push(key) },
    },
    fetch: async () => { throw new Error('Network unavailable') },
  })
  let activation
  events.activate({ waitUntil: (promise) => { activation = promise } })
  await activation
  assert.deepEqual(deleted, ['bookeasy-pwa-v1-static'])
  assert.ok(claimed)
  let response
  events.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://www.bookeasy.ro/dashboard/calendar' },
    respondWith: (promise) => { response = promise },
  })
  const fallback = await response
  assert.equal(fallback.status, 503)
  assert.equal(fallback.headers.get('cache-control'), 'no-store')
  const html = await fallback.text()
  assert.ok(html.includes('location.reload()'))
  assert.ok(!html.includes('/_next/'))
  for (const path of ['/api/business/bookings', '/_next/static/chunks/example.js']) {
    events.fetch({
      request: { method: 'GET', mode: 'cors', url: `https://www.bookeasy.ro${path}` },
      respondWith: () => assert.fail(`Unexpected interception: ${path}`),
    })
  }
  console.log('PASS: offline response works without cached assets; private APIs and Next bundles bypass PWA cache; legacy cache removed')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
