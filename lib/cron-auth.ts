import crypto from 'crypto'

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const authorization = req.headers.get('authorization')
  if (!secret || !authorization) return false

  const expected = `Bearer ${secret}`
  const actualBuffer = Buffer.from(authorization)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}
