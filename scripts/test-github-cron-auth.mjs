import assert from 'node:assert/strict'
import { generateKeyPairSync, createSign } from 'node:crypto'
import { isAuthorizedGithubCronRequest } from '../lib/github-cron-auth.ts'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', kty: 'RSA', use: 'sig', alg: 'RS256' }
const originalFetch = globalThis.fetch
globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })

function token(overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'bookeasy-reconfirmation-cron',
    repository: 'ianchisionut-ux/bookeasy',
    repository_id: '1319844384',
    workflow_ref: 'ianchisionut-ux/bookeasy/.github/workflows/reconfirmation-alerts.yml@refs/heads/main',
    ref: 'refs/heads/main',
    event_name: 'schedule',
    iat: now,
    nbf: now,
    exp: now + 300,
    ...overrides,
  })).toString('base64url')
  const data = `${header}.${claims}`
  const signature = createSign('RSA-SHA256').update(data).sign(privateKey).toString('base64url')
  return `${data}.${signature}`
}

try {
  const request = (value) => new Request('https://bookeasy.ro/api/cron/reminders', { headers: { authorization: `Bearer ${value}` } })
  assert.equal(await isAuthorizedGithubCronRequest(request(token())), true)
  assert.equal(await isAuthorizedGithubCronRequest(request(token({ aud: 'other' }))), false)
  assert.equal(await isAuthorizedGithubCronRequest(request(token({ repository_id: 'wrong' }))), false)
  assert.equal(await isAuthorizedGithubCronRequest(request(token({ workflow_ref: 'other' }))), false)
  assert.equal(await isAuthorizedGithubCronRequest(request(token({ exp: 0 }))), false)
  const signed = token()
  assert.equal(await isAuthorizedGithubCronRequest(request(`${signed.slice(0, -1)}x`)), false)
  console.log('GitHub cron OIDC authentication tests: OK')
} finally {
  globalThis.fetch = originalFetch
}
