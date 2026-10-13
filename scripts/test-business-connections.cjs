const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const crypto = require('node:crypto')
const { NextRequest } = require('next/server')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((name) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

async function main() {
  process.env.APP_URL = 'https://www.bookeasy.ro'
  process.env.AUTH_SECRET = 'test-only-oauth-signing-secret'
  process.env.META_APP_SECRET = 'test-only-meta-secret'
  process.env.INSTAGRAM_APP_SECRET = 'test-only-instagram-secret'
  process.env.INSTAGRAM_APP_ID = '123456'
  let rows = []
  let raceOwner
  const prisma = { channel: {
    findUnique: async ({ where }) => rows.find((r) => where.id ? r.id === where.id : r.type === where.type_externalId.type && r.externalId === where.type_externalId.externalId) ?? null,
    updateMany: async ({ where, data }) => { let count = 0; for (const row of rows) if (row.businessId === where.businessId && row.type === where.type && row.externalId === where.externalId) { Object.assign(row, data); count++ } return { count } },
    create: async ({ data }) => {
      if (raceOwner) { rows.push({ ...data, businessId: raceOwner }); raceOwner = null; throw { code: 'P2002' } }
      rows.push({ id: `channel-${rows.length}`, ...data }); return rows.at(-1)
    },
  }, business: { findUnique: async ({ where }) => where.id === 'business-a' ? { id: where.id } : null } }
  const connection = load('lib/business-channel-connection.ts', { '@/lib/prisma': { prisma } })
  for (const type of ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GOOGLE_BUSINESS']) {
    rows = []
    await connection.saveBusinessChannel('business-a', type, '123', { accessToken: 'a', authProvider: 'test' })
    await connection.saveBusinessChannel('business-a', type, '123', { accessToken: 'renewed', authProvider: 'test' })
    await assert.rejects(() => connection.saveBusinessChannel('business-b', type, '123', { accessToken: 'b', authProvider: 'test' }), connection.ChannelOwnershipError)
    assert.equal(rows[0].businessId, 'business-a')
    assert.equal(rows[0].accessToken, 'renewed')
    rows = []; raceOwner = 'business-b'
    await assert.rejects(() => connection.saveBusinessChannel('business-a', type, '123', { accessToken: 'a', authProvider: 'test' }), connection.ChannelOwnershipError)
    assert.equal(rows[0].businessId, 'business-b')
  }
  rows = []
  const encryption = { encrypt: (v) => `encrypted:${v}`, decrypt: (v) => v.replace(/^encrypted:/, '') }
  const instagram = load('lib/instagram-login.ts', { '@/lib/crypto': encryption, '@/lib/business-channel-connection': connection })
  let calls = []
  const responses = [
    { data: [{ access_token: 'short', user_id: 'app-scoped-id', permissions: 'instagram_business_basic,instagram_business_manage_messages' }] },
    { access_token: 'long', expires_in: 5184000 },
    { id: 'app-scoped-id', user_id: '98765', username: 'test-business' },
    { success: true },
  ]
  global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return { ok: true, json: async () => responses.shift() } }
  await instagram.connectInstagram('business-a', 'test-code', 'https://www.bookeasy.ro/api/oauth/instagram/callback')
  assert.equal(rows[0].externalId, '98765', 'Uses professional ID, not app-scoped ID')
  assert.equal(rows[0].authProvider, 'instagram')
  assert.equal(rows[0].accessToken, 'encrypted:long')
  assert.equal(calls[0].options.body.get('client_id'), '123456')
  assert.ok(calls[2].url.startsWith('https://graph.instagram.com/'))
  assert.ok(calls[3].url.includes('/98765/subscribed_apps'))
  assert.equal(calls[3].options.headers.Authorization, 'Bearer long')
  assert.equal(calls.some((c) => c.url.includes('graph.facebook.com')), false)
  calls = []
  responses.push({ access_token: 'short', permissions: ['instagram_business_basic'] })
  await assert.rejects(() => instagram.connectInstagram('business-a', 'code', 'https://www.bookeasy.ro/api/oauth/instagram/callback'), /Acordă acces/)
  assert.equal(calls.length, 1)

  const oauth = load('lib/oauth-state.ts', {})
  let session = { userId: 'owner-a', role: 'OWNER', businessId: 'business-a' }
  const start = load('app/api/oauth/[provider]/start/route.ts', { '@/lib/auth': { auth: async () => session }, '@/lib/prisma': { prisma }, '@/lib/oauth-state': oauth, '@/lib/instagram-login': instagram })
  const params = { params: Promise.resolve({ provider: 'instagram' }) }
  const startResponse = await start.GET(new NextRequest('https://www.bookeasy.ro/api/oauth/instagram/start?source=settings&businessId=business-b'), params)
  const authUrl = new URL(startResponse.headers.get('location'))
  assert.equal(authUrl.hostname, 'www.instagram.com')
  assert.equal(authUrl.searchParams.get('enable_fb_login'), 'false')
  assert.equal(authUrl.searchParams.get('scope'), instagram.INSTAGRAM_SCOPE)
  const signedState = authUrl.searchParams.get('state')
  const state = oauth.verifyOAuthState(signedState, 'instagram')
  assert.equal(state.businessId, 'business-a', 'Owner cannot select another tenant through query')
  assert.equal(state.userId, 'owner-a')
  assert.equal(oauth.verifyOAuthState(signedState + 'tampered', 'instagram'), null)
  assert.equal(oauth.verifyOAuthState(signedState, 'meta'), null)
  assert.equal(oauth.verifyOAuthState(oauth.signOAuthState({ ...state, issuedAt: Date.now() + 60000 }), 'instagram'), null)
  assert.equal(oauth.verifyOAuthState(oauth.signOAuthState({ ...state, redirectTo: '//evil.example' }), 'instagram'), null)
  session = { ...session, role: 'STAFF' }
  assert.equal((await start.GET(new NextRequest('https://www.bookeasy.ro/api/oauth/instagram/start'), params)).status, 403)
  session = { ...session, role: 'OWNER' }
  let connected = 0
  const callback = load('app/api/oauth/[provider]/callback/route.ts', { '@/lib/auth': { auth: async () => session }, '@/lib/prisma': { prisma }, '@/lib/oauth-state': oauth, '@/lib/crypto': encryption, '@/lib/instagram-login': { ...instagram, connectInstagram: async () => { connected++ } }, '@/lib/business-channel-connection': connection })
  const callbackRequest = (cookie, code = 'test-code') => new NextRequest(`https://www.bookeasy.ro/api/oauth/instagram/callback?code=${code}&state=${encodeURIComponent(signedState)}`, { headers: cookie ? { cookie: `bookeasy_oauth_instagram=${cookie}` } : {} })
  await callback.GET(callbackRequest(null), params)
  assert.equal(connected, 0, 'Callback needs browser-bound nonce')
  session = { ...session, userId: 'owner-b' }
  await callback.GET(callbackRequest(state.nonce), params)
  assert.equal(connected, 0, 'Callback is bound to initiating user')
  session = { ...session, userId: 'owner-a', businessId: 'business-b' }
  await callback.GET(callbackRequest(state.nonce), params)
  assert.equal(connected, 0, 'Callback cannot change tenants')
  session = { ...session, businessId: 'business-a' }
  assert.ok((await callback.GET(callbackRequest(state.nonce), params)).headers.get('location').endsWith('/dashboard/setari?connected=instagram'))
  assert.equal(connected, 1)

  rows = [{ id: 'direct', businessId: 'business-a', type: 'INSTAGRAM', externalId: '98765', authProvider: 'instagram', accessToken: 'encrypted:long', status: 'ACTIVE' }, { id: 'legacy', type: 'FACEBOOK', externalId: '123', authProvider: 'meta', accessToken: 'encrypted:page' }]
  calls = []
  global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return { ok: true, json: async () => ({ success: true }) } }
  const senders = load('lib/channel-senders.ts', { './prisma': { prisma }, './crypto': encryption, './instagram-login': instagram })
  await senders.sendMessage({ channel: 'INSTAGRAM', channelId: 'direct', to: 'sender', text: 'Test' })
  await senders.sendMessengerCarousel({ channelId: 'direct', to: 'sender', cards: [{ id: 'test', title: 'Test', buttonLabel: 'Select' }] })
  await senders.sendMessage({ channel: 'FACEBOOK', channelId: 'legacy', to: 'sender', text: 'Test' })
  assert.ok(calls[0].url.startsWith('https://graph.instagram.com/v26.0/98765/messages'))
  assert.equal(calls[1].url, calls[0].url)
  assert.equal(calls[2].url, 'https://graph.facebook.com/v21.0/me/messages')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer long')

  let incoming = []
  const seen = new Set()
  prisma.processedWebhookMessage = { create: async ({ data }) => { if (seen.has(data.id)) throw new Error('duplicate'); seen.add(data.id) } }
  const webhook = load('app/api/webhooks/meta/route.ts', { '@/lib/prisma': { prisma }, '@/lib/bot-engine': { processIncomingMessage: async (v) => incoming.push(v) }, '@/lib/google-calendar': {}, '@/lib/channel-senders': {} })
  const payload = JSON.stringify({ object: 'instagram', entry: [{ id: '98765', messaging: [1, 2].map((i) => ({ sender: { id: `sender-${i}` }, message: { mid: `mid-${i}`, text: `Test ${i}` } })) }] })
  const webhookRequest = (secret) => new NextRequest('https://www.bookeasy.ro/api/webhooks/meta', { method: 'POST', body: payload, headers: { 'x-hub-signature-256': `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}` } })
  await webhook.POST(webhookRequest(process.env.META_APP_SECRET))
  assert.equal(incoming.length, 0, 'Parent app cannot route events for direct Instagram credentials')
  await webhook.POST(webhookRequest(process.env.INSTAGRAM_APP_SECRET))
  assert.equal(incoming.length, 2, 'Processes every event in a batch')
  assert.equal(incoming.every((v) => v.businessId === 'business-a'), true)
  await webhook.POST(webhookRequest(process.env.INSTAGRAM_APP_SECRET))
  assert.equal(incoming.length, 2, 'Duplicate events do not repeat actions')
  assert.equal((await webhook.POST(webhookRequest('wrong-secret'))).status, 401)
  console.log('Business connections passed: separate Instagram OAuth, tenant ownership including races, owner-only and user/browser-bound callbacks, token-ID mapping, send hosts, webhook signatures, batching and deduplication.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
