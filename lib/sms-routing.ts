import { prisma } from '@/lib/prisma'
import { platformSmsReady } from '@/lib/sms-availability'

export async function isPlatformSmsReady() {
  const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' }, select: { enabled: true, phone: true, lastSeenAt: true } })
  return platformSmsReady(gateway)
}

export async function resolveSmsSender(business: { id: string }) {
  const current = await prisma.business.findUnique({ where: { id: business.id } })
  if (!current) throw new Error('Afacerea nu a fost găsită.')
  const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' } })
  return { businessEnabled: current.smsGatewayEnabled, accountActive: current.accountActive, key: 'platform', phone: gateway?.phone, enabled: Boolean(gateway?.enabled), lastSeenAt: gateway?.lastSeenAt, lastError: gateway?.lastError }
}
