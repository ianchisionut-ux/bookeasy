import { prisma } from './prisma'
import { effectiveBusinessPlan, hasBusinessPlan, type BusinessPlan } from './business-plans'

export async function businessHasPlan(businessId: string, required: BusinessPlan, isSuperAdmin = false) {
  if (isSuperAdmin) return true
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { accountActive: true, planName: true, billingStatus: true, launchEnrollment: { select: { cancelledAt: true } } },
  })
  return Boolean(business?.accountActive && hasBusinessPlan(effectiveBusinessPlan(business), required))
}
