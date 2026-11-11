import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export function createSmsDeviceToken(businessId: string) {
  if (businessId !== 'platform') throw new Error('Folosește gateway-ul SMS central.')
  const token = `${businessId}.${crypto.randomBytes(32).toString('base64url')}`
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') }
}

export async function authenticateSmsDevice(authorization: string | null) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const dot = token.indexOf('.')
  if (dot < 1 || token.length > 200) return null
  const businessId = token.slice(0, dot)
  if (businessId === 'platform') {
    const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' } })
    if (!gateway?.tokenHash) return null
    const candidate = crypto.createHash('sha256').update(token).digest()
    const expected = Buffer.from(gateway.tokenHash, 'hex')
    if (expected.length !== candidate.length || !crypto.timingSafeEqual(expected, candidate)) return null
    return { id: 'platform', smsGatewayPhone: gateway.phone, smsGatewayEnabled: gateway.enabled }
  }
  return null // Individual business phones are no longer accepted.
}

export async function updateSmsDevice(id: string, data: { smsDeviceLastSeenAt?: Date | null; smsGatewayLastError?: string | null }) {
  if (id === 'platform') return prisma.platformSmsGateway.update({ where: { id: 'central' }, data: { ...(data.smsDeviceLastSeenAt !== undefined ? { lastSeenAt: data.smsDeviceLastSeenAt } : {}), ...(data.smsGatewayLastError !== undefined ? { lastError: data.smsGatewayLastError } : {}) } })
  throw new Error('Gateway SMS individual dezactivat.')
}
