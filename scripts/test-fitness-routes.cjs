// Executes the actual route/auth code with a mocked persistence boundary.
// No network, real credentials, production data or test users are involved.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const crypto = require('node:crypto')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const business = { id: 'business-a', category: 'FITNESS', accountActive: true, timezone: 'Europe/Bucharest', name: 'Test Fitness' }
const a = { id: 'a', businessId: business.id, customerId: 'customer-a', active: true, customer: { name: 'A' }, business }
const b = { id: 'b', businessId: 'business-b', customerId: 'customer-b', active: true, customer: { name: 'B' }, business: { ...business, id: 'business-b' } }
const sessionToken = 'a'.repeat(64), inviteToken = 'b'.repeat(64)
a.inviteHash = hash(inviteToken); a.inviteExpiresAt = new Date(Date.now() + 60000)
let cookie = sessionToken, role = 'OWNER', currentUser = 'owner', inviteUsed = false
let sessions = [{ tokenHash: hash(sessionToken), clientId: 'a', expiresAt: new Date(Date.now() + 60000), client: a }]
const rows = [{ id: 'entry-a', clientId: 'a', version: 1, completed: false }, { id: 'entry-b', clientId: 'b', version: 1, completed: false }]
const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value)
const db = {
  user: { findUnique: async () => currentUser ? { id: currentUser, role, business } : null },
  fitnessSession: {
    findUnique: async ({ where }) => sessions.find(s => s.tokenHash === where.tokenHash) || null,
    create: async ({ data }) => { sessions.push({ ...data, client: a }); return data },
    deleteMany: async ({ where }) => { sessions = sessions.filter(s => where.tokenHash ? s.tokenHash !== where.tokenHash : where.expiresAt ? s.expiresAt >= where.expiresAt.lt : s.clientId !== where.clientId); return { count: 1 } },
  },
  fitnessClient: {
    findFirst: async ({ where }) => [a,b].find(c => matches(c, where)) || null,
    findUnique: async ({ where }) => [a,b].find(c => matches(c, where)) || null,
    update: async ({ where, data }) => { Object.assign([a,b].find(c => c.id === where.id), data) },
    updateMany: async ({ where, data }) => {
      if (inviteUsed || !a.inviteHash || a.inviteHash !== where.inviteHash || a.inviteExpiresAt <= where.inviteExpiresAt.gt) return { count: 0 }
      Object.assign(a, data); inviteUsed = true; return { count: 1 }
    },
  },
  customer: { findFirst: async ({ where }) => where.id === 'customer-a' && where.businessId === business.id ? { id: 'customer-a' } : null },
  fitnessEntry: {
    findMany: async ({ where }) => rows.filter(r => r.clientId === where.clientId),
    updateMany: async ({ where, data }) => { const row = rows.find(r => matches(r, where)); if (!row) return { count: 0 }; const version = row.version + 1; Object.assign(row, data, { version }); return { count: 1 } },
    deleteMany: async () => { throw new Error('Client must never reach delete') },
  },
  booking: { findMany: async ({ where }) => { assert.equal(where.businessId, 'business-a'); assert.equal(where.customerId, 'customer-a'); return [] } },
  fitnessMessage: { findMany: async ({ where }) => { assert.equal(where.clientId, 'a'); return [] } },
}
db.$transaction = fn => fn(db)
const modules = new Map()
function load(file) {
  const absolute = path.resolve(file)
  if (modules.has(absolute)) return modules.get(absolute).exports
  const module = { exports: {} }; modules.set(absolute, module)
  const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  function injectedRequire(name) {
    if (name === '@/lib/prisma') return { prisma: db }
    if (name === '@/lib/auth') return { auth: async () => currentUser ? { userId: currentUser } : null }
    if (name === '@/lib/rate-limit') return { getClientIp: () => 'test', rateLimit: () => ({ allowed: true }) }
    if (name === 'next/headers') return { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) }
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`)
    return require(name)
  }
  new Function('require', 'module', 'exports', output)(injectedRequire, module, module.exports)
  return module.exports
}
const entries = load('app/api/fitness/entries/route.ts')
const update = load('app/api/fitness/entries/[id]/route.ts')
const sessionRoute = load('app/api/fitness/session/route.ts')
const clients = load('app/api/fitness/clients/route.ts')
const request = (url, method = 'GET', body, origin = 'https://example.test') => new Request(`https://example.test${url}`, { method, headers: { origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
const context = id => ({ params: Promise.resolve({ id }) })
async function main() {
  // A client cannot select another client by changing the query string.
  let r = await entries.GET(request('/api/fitness/entries?clientId=b&from=2026-09-01&to=2026-09-07'))
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).entries.map(e => e.id), ['entry-a'])
  r = await update.PATCH(request('/api/fitness/entries/entry-b', 'PATCH', { completed: true, feedback: '', version: 1 }), context('entry-b'))
  assert.equal(r.status, 409); assert.equal(rows[1].completed, false)
  r = await update.PATCH(request('/api/fitness/entries/entry-a', 'PATCH', { completed: true, feedback: '', version: 1, title: 'Hijack' }), context('entry-a'))
  assert.equal(r.status, 400)
  r = await update.PATCH(request('/api/fitness/entries/entry-a', 'PATCH', { completed: true, feedback: 'Done', version: 1 }), context('entry-a'))
  assert.equal(r.status, 200); assert.equal(rows[0].completed, true)
  r = await update.PATCH(request('/api/fitness/entries/entry-a', 'PATCH', { completed: false, feedback: '', version: 1 }), context('entry-a'))
  assert.equal(r.status, 409); assert.equal(rows[0].completed, true)
  r = await update.DELETE(request('/api/fitness/entries/entry-a', 'DELETE', { version: 2 }), context('entry-a'))
  assert.equal(r.status, 403)
  r = await update.PATCH(request('/api/fitness/entries/entry-a', 'PATCH', { completed: false, feedback: '', version: 2 }, 'https://evil.test'), context('entry-a'))
  assert.equal(r.status, 403)
  // Owner is tenant-scoped; STAFF and non-Fitness owners are denied.
  r = await entries.GET(request('/api/fitness/entries?mode=instructor&clientId=b&from=2026-09-01&to=2026-09-07')); assert.equal(r.status, 404)
  role = 'STAFF'
  r = await entries.GET(request('/api/fitness/entries?mode=instructor&clientId=a&from=2026-09-01&to=2026-09-07')); assert.equal(r.status, 403)
  role = 'OWNER'; business.category = 'SALON'
  r = await entries.GET(request('/api/fitness/entries?mode=instructor&clientId=a&from=2026-09-01&to=2026-09-07')); assert.equal(r.status, 403)
  business.category = 'FITNESS'; cookie = undefined
  r = await entries.GET(request('/api/fitness/entries?from=2026-09-01&to=2026-09-07')); assert.equal(r.status, 401)
  // Invite redemption is single use, hashed and delivered via HttpOnly cookie.
  r = await sessionRoute.POST(request('/api/fitness/session', 'POST', { token: inviteToken })); assert.equal(r.status, 200)
  assert.match(r.headers.get('set-cookie'), /HttpOnly/); assert.match(r.headers.get('set-cookie'), /Secure/)
  r = await sessionRoute.POST(request('/api/fitness/session', 'POST', { token: inviteToken })); assert.equal(r.status, 401)
  // Revocation destroys existing sessions, not plans.
  cookie = sessionToken
  r = await clients.POST(request('/api/fitness/clients', 'POST', { customerId: 'customer-a', action: 'revoke' })); assert.equal(r.status, 200)
  r = await entries.GET(request('/api/fitness/entries?from=2026-09-01&to=2026-09-07')); assert.equal(r.status, 401)
  assert.equal(rows.length, 2)
  console.log('Fitness route tests passed: tenant isolation, role checks, field permissions, concurrency, CSRF, invitations and revocation (mock database).')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
