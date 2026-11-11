import { createHmac } from 'node:crypto'
import { prisma } from './prisma'

export function accountHash(key: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Authentication secret unavailable')
  return createHmac('sha256', secret).update(`account:${key}`).digest('hex')
}

export async function accountSessionRevoked(token: { id?: unknown; googleSub?: unknown; role?: unknown; accountSessionStartedAt?: unknown; iat?: number }) {
  const keys = typeof token.id === 'string' ? [`user:${token.id}`] : []
  if (token.role === 'CUSTOMER' && typeof token.googleSub === 'string') keys.push(`google:${token.googleSub}`)
  if (!keys.length) return true
  const hashes = keys.map(accountHash)
  const rows = await prisma.$queryRaw<{ revokedAt: Date }[]>`SELECT "revokedAt" FROM "AccountRevocation" WHERE "ownerHash" = ANY(${hashes}::text[])`
  const started = typeof token.accountSessionStartedAt === 'number' ? token.accountSessionStartedAt : (token.iat ?? 0) * 1000
  return rows.some(row => row.revokedAt.getTime() >= started)
}
