import { auth as sessionAuth } from './auth'
import { prisma } from './prisma'
import { effectiveBusinessPlan, hasBusinessPlan, type BusinessPlan } from './business-plans'

// Recheck the database on every API request, including previously issued JWTs.
export async function auth(requiredPlan: BusinessPlan = 'FREE') {
  const session = await sessionAuth()
  const businessId = (session as any)?.businessId
  if (!session || !businessId || (session as any).role === 'CUSTOMER') return null
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { accountActive: true, planName: true, billingStatus: true, launchEnrollment: { select: { cancelledAt: true } } },
  })
  const isSuperAdmin = Boolean((session as any).isSuperAdmin)
  if (!business || (!business.accountActive && !isSuperAdmin)) return null
  const plan = effectiveBusinessPlan(business, isSuperAdmin)
  return hasBusinessPlan(plan, requiredPlan) ? session : null
}
