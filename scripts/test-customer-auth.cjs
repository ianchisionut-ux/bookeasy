const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const bcrypt = require('bcryptjs')
const { NextRequest } = require('next/server')
const { Prisma } = require('@prisma/client')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((name) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

async function main() {
  let created
  let duplicate = false
  let allowed = true
  const registration = load('app/api/auth/customer/register/route.ts', {
    '@/lib/prisma': { prisma: { user: { create: async ({ data }) => {
      if (duplicate) throw new Prisma.PrismaClientKnownRequestError('Duplicate', { code: 'P2002', clientVersion: '6.19.3' })
      created = data
    } } } },
    '@/lib/rate-limit': { getClientIp: () => 'test', rateLimit: () => ({ allowed }) },
  })
  const request = (body, origin = 'https://www.bookeasy.ro') => new NextRequest('https://www.bookeasy.ro/api/auth/customer/register', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const account = { email: '  Client@Example.com  ', password: 'password-for-test-123', role: 'SUPER_ADMIN', businessId: 'other-business' }
  assert.equal((await registration.POST(request(account, 'https://other.example'))).status, 403)
  assert.equal((await registration.POST(request('{invalid'))).status, 400)
  assert.equal((await registration.POST(request({ ...account, password: 'short' }))).status, 400)
  assert.equal(created, undefined)
  assert.equal((await registration.POST(request(account))).status, 201)
  assert.equal(created.email, 'client@example.com')
  assert.equal(created.role, 'CUSTOMER')
  assert.equal(created.businessId, null)
  assert.notEqual(created.password, account.password)
  assert.equal(await bcrypt.compare(account.password, created.password), true)
  duplicate = true
  assert.equal((await registration.POST(request(account))).status, 409)
  allowed = false
  assert.equal((await registration.POST(request(account))).status, 429)

  let config
  let stored = { id: 'customer', email: created.email, password: created.password, role: 'CUSTOMER', businessId: null }
  load('lib/auth.ts', {
    'next-auth': (options) => { config = options; return {} },
    'next-auth/providers/credentials': (options) => ({ ...options, id: 'credentials' }),
    'next-auth/providers/google': (options) => ({ ...options, id: 'google' }),
    './prisma': { prisma: { user: { findUnique: async () => stored } } },
    './rate-limit': { rateLimit: () => ({ allowed: true }) },
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    './superadmin-business-access': { SUPERADMIN_BUSINESS_COOKIE: 'test-business' },
  })
  const authorize = config.providers.find((provider) => provider.id === 'credentials').authorize
  const credentials = { email: created.email, password: account.password }
  assert.equal(await authorize(credentials, request({})), null, 'Customer cannot use business login')
  assert.equal((await authorize({ ...credentials, accountType: 'customer' }, request({}))).role, 'CUSTOMER')
  stored = { ...stored, role: 'OWNER', businessId: 'business' }
  assert.equal(await authorize({ ...credentials, accountType: 'customer' }, request({})), null, 'Business cannot use customer login')
  assert.equal((await authorize(credentials, request({}))).role, 'OWNER')
  assert.equal(await authorize({ ...credentials, password: 'wrong-password' }, request({})), null)
  const token = await config.callbacks.jwt({ token: {}, account: { provider: 'google', providerAccountId: 'google-sub' } })
  assert.equal(token.role, 'CUSTOMER')
  assert.equal(token.businessId, null)
  const session = await config.callbacks.session({ session: { user: {} }, token })
  assert.equal(session.isSuperAdmin, false)
  assert.equal(await config.callbacks.signIn({ account: { provider: 'google' }, profile: { sub: 'google-sub', email_verified: false } }), false)
  console.log('Customer auth passed: registration validation, origin check, rate limit, password hashing, duplicate email and business/customer isolation.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
