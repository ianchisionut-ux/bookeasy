import { createHash } from 'crypto'
import { prisma } from './prisma'

// Atomic counters shared across serverless instances; hashed keys contain no PII.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
  const bucketKey = createHash('sha256').update(key).digest('hex')
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${bucketKey}, 1, clock_timestamp() + ${windowMs} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= clock_timestamp() THEN 1 ELSE LEAST("RateLimitBucket"."count" + 1, ${limit + 1}) END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= clock_timestamp() THEN clock_timestamp() + ${windowMs} * interval '1 millisecond' ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count"
    `
    const count = rows[0]?.count ?? limit + 1
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    console.error('[rate-limit] Shared counter unavailable')
    return { allowed: false, remaining: 0 }
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
