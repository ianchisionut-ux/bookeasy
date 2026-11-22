import { prisma } from '@/lib/prisma'
import { platformSmsReady } from '@/lib/sms-availability'
import { smsApiConfig, usesSmsApi } from '@/lib/smsapi'

export async function isPlatformSmsReady() {
  if (usesSmsApi()) return Boolean(smsApiConfig())
  const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' }, select: { enabled: true, phone: true, lastSeenAt: true } })
  return platformSmsReady(gateway)
}

export async function resolveSmsSender(business: { id: string }) {
  const current = await prisma.business.findUnique({ where: { id: business.id }, select: { smsGatewayEnabled: true, accountActive: true } })
  if (!current) throw new Error('Afacerea nu a fost găsită.')
  if (usesSmsApi()) {
    const enabled = Boolean(smsApiConfig())
    return { businessEnabled: current.smsGatewayEnabled, accountActive: current.accountActive, key: 'smsapi' as const, phone: null, enabled, lastSeenAt: null, lastError: enabled ? null : 'SMSAPI nu este configurat complet.' }
  }
  const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' } })
  return { businessEnabled: current.smsGatewayEnabled, accountActive: current.accountActive, key: 'platform' as const, phone: gateway?.phone, enabled: Boolean(gateway?.enabled), lastSeenAt: gateway?.lastSeenAt, lastError: gateway?.lastError }
}
