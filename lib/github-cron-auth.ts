import { createPublicKey, verify, type JsonWebKey as NodeJsonWebKey } from 'node:crypto'

const ISSUER = 'https://token.actions.githubusercontent.com'
const JWKS_URL = `${ISSUER}/.well-known/jwks`
const AUDIENCE = 'bookeasy-reconfirmation-cron'
const REPOSITORY = 'ianchisionut-ux/bookeasy'
const REPOSITORY_ID = '1319844384'
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/reconfirmation-alerts.yml@refs/heads/main`

type TokenHeader = { alg?: unknown; kid?: unknown }
type TokenClaims = Record<string, unknown>
type SigningKey = JsonWebKey & { kid?: string; kty?: string; use?: string; alg?: string }

export async function isAuthorizedGithubCronRequest(req: Request): Promise<boolean> {
  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const token = authorization.slice('Bearer '.length)
  if (token.length > 10_000) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) return false

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as TokenHeader
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as TokenClaims
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 256) return false

    const now = Math.floor(Date.now() / 1000)
    if (claims.iss !== ISSUER || claims.aud !== AUDIENCE || claims.repository !== REPOSITORY ||
        claims.repository_id !== REPOSITORY_ID || claims.workflow_ref !== WORKFLOW_REF ||
        claims.ref !== 'refs/heads/main' ||
        !['schedule', 'workflow_dispatch'].includes(String(claims.event_name)) ||
        typeof claims.exp !== 'number' || claims.exp <= now ||
        typeof claims.iat !== 'number' || claims.iat > now + 60 ||
        claims.exp - claims.iat > 600 ||
        (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now + 60))) return false

    const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (!response.ok) return false
    const jwks = await response.json() as { keys?: SigningKey[] }
    const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig' && key.alg === 'RS256')
    if (!jwk) return false

    const key = createPublicKey({ key: jwk as NodeJsonWebKey, format: 'jwk' })
    return verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))
  } catch {
    return false
  }
}

