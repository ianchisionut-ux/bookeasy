import { prisma } from '@/lib/prisma'
import { smsApiAvailability } from '@/lib/smsapi'

export async function isPlatformSmsReady() {
  return smsApiAvailability().online
}

export async function readBusinessSmsSettings(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { smsGatewayEnabled: true, accountActive: true } })
  if (!business) throw new Error('Afacerea nu a fost găsită.')
  return business
}
