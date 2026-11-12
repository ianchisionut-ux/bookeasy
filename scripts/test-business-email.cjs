const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.join(__dirname, '..')
function load(file, mocks) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText
  new Function('require', 'module', 'exports', code)(n => n in mocks ? mocks[n] : require(n), m, m.exports)
  return m.exports
}
async function main() {
  let config
  class CredentialsSignin extends Error {}
  let user = {id: 'user', email: 'test@example.invalid', password: 'correct', role: 'OWNER', businessId: 'business', emailVerificationRequired: true, emailVerifiedAt: null}
  load('lib/auth.ts', {
    'next-auth': {__esModule: true, default: c => {config = c; return {auth: async () => null}}, CredentialsSignin},
    './native-google-auth': {consumeNativeGoogleFlow: async () => null},
    'next-auth/providers/credentials': {__esModule: true, default: c => c},
    'next-auth/providers/google': {__esModule: true, default: c => c},
    './prisma': {prisma: {user: {findUnique: async () => user}}},
    'bcryptjs': {__esModule: true, default: {compare: async (password, hash) => password === hash}},
    './rate-limit': {rateLimit: async () => ({allowed: true})},
    'next/headers': {cookies: async () => ({get: () => null})},
    './superadmin-business-access': {SUPERADMIN_BUSINESS_COOKIE: 'test'},
    './session-revocation': {accountSessionRevoked: async () => false},
  })
  const authorize = config.providers[0].authorize
  const request = {headers: new Headers()}
  const credentials = {email: user.email, password: 'correct', accountType: 'business'}
  assert.equal((await authorize(credentials, request)).id, 'user')
  assert.equal(await authorize({...credentials, password: 'wrong'}, request), null)
  user = {...user, role: 'CUSTOMER'}
  assert.equal(await authorize(credentials, request), null)
  await assert.rejects(authorize({...credentials, accountType: 'customer'}, request), e => e.code === 'email_not_verified')
  console.log('PASS existing unconfirmed business login; wrong password and account type rejected; customer verification preserved')
  let created
  const registration = load('app/api/auth/register/route.ts', {
    'next/server': {NextResponse: {json: (body, options) => ({body, status: options?.status ?? 200})}},
    '@/lib/prisma': {prisma: {user: {findUnique: async () => null}, business: {create: async input => {created = input.data; return input.data}}}},
    'bcryptjs': {__esModule: true, default: {hash: async () => 'hashed-password'}},
    '@/lib/rate-limit': {getClientIp: () => '127.0.0.1', rateLimit: async () => ({allowed: true})},
    '@/lib/launch-campaign': {LaunchSignupError: class extends Error {}, launchSignupData: async () => ({})},
    '@/lib/signup-funnel': {recordSignupFunnel: async () => {}},
    '@/lib/email-verification': {sendVerificationEmail: async () => {throw Error('Email must not be sent')}},
  })
  const response = await registration.POST({headers: new Headers({origin: 'https://bookeasy.ro'}), nextUrl: {origin: 'https://bookeasy.ro'}, json: async () => ({email: 'new@example.invalid', password: 'password123', acceptSubscriptionTerms: true})})
  assert.equal(response.status, 200)
  assert.equal(response.body.requiresEmailVerification, false)
  assert.equal(created.users.create.emailVerificationRequired, false)
  assert.equal(created.users.create.password, 'hashed-password')
  console.log('PASS new business registration requires no email and creates a password-protected account')
  for (const file of ['lib/auth.ts', 'app/api/auth/register/route.ts', 'app/signup/signup-form.tsx', 'app/login/page.tsx']) {
    const result = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {fileName: file, reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve}})
    assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file)
  }
  console.log('PASS syntax checks for all changed files')
}
main().catch(error => {console.error(error); process.exitCode = 1})
