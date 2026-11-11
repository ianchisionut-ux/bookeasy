import crypto from 'crypto'

export function signCalendarState(payload: object) {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET lipsește.')
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', process.env.AUTH_SECRET ?? '').update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyCalendarState(state: string) {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET lipsește.')
  const [encoded, signature] = state.split('.')
  if (!encoded || !signature) throw new Error('Stare OAuth invalidă.')
  const expected = crypto.createHmac('sha256', process.env.AUTH_SECRET ?? '').update(encoded).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Stare OAuth invalidă.')
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as {
    businessId: string
    practitionerId: string
    expiresAt: number
    userId: string
    nonce: string
    initiatedBySuperAdmin?: boolean
    returnTo?: 'settings' | 'practitioners'
  }
  if (!parsed.businessId || !parsed.practitionerId || !parsed.userId || !parsed.nonce || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt < Date.now() || parsed.expiresAt > Date.now() + 10 * 60_000) throw new Error('Conectarea a expirat.')
  return parsed
}
