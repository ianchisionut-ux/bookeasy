import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function smsSettingsBusinessId(requested?: string) {
  const session = await auth() as any
  if (!session || !['OWNER', 'SUPER_ADMIN'].includes(session.role)) return null
  const businessId = session.role === 'SUPER_ADMIN' && requested ? requested : session.businessId
  if (!businessId || (requested && requested !== businessId)) return null
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { accountActive: true } })
  return business && (business.accountActive || session.role === 'SUPER_ADMIN') ? businessId as string : null
}
