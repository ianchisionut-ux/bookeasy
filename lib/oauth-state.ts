import crypto from 'crypto'

export type OAuthState = {
  provider: 'google' | 'meta'
  businessId: string
  redirectTo: string
  nonce: string
  issuedAt: number
}

function signingSecret() {
  const secret = process.env.AUTH_SECRET || process.env.META_APP_SECRET
  if (!secret) throw new Error('AUTH_SECRET lipsește din configurare.')
  return secret
}

export function signOAuthState(payload: OAuthState) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', signingSecret()).update(encoded).digest('base64url')
  return encoded + '.' + signature
}

export function verifyOAuthState(value: string, provider: OAuthState['provider']): OAuthState | null {
  const [encoded, suppliedSignature] = value.split('.')
  if (!encoded || !suppliedSignature) return null

  const expectedSignature = crypto.createHmac('sha256', signingSecret()).update(encoded).digest('base64url')
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as OAuthState
    const isFresh = Number.isFinite(payload.issuedAt) && Date.now() - payload.issuedAt < 10 * 60 * 1000
    if (!isFresh || payload.provider !== provider || !payload.businessId || !payload.nonce) return null
    return payload
  } catch {
    return null
  }
}
