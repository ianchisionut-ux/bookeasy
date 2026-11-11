export type BusinessPlan = 'FREE' | 'STANDARD' | 'PRO'

export const PLAN_RANK: Record<BusinessPlan, number> = { FREE: 0, STANDARD: 1, PRO: 2 }

export function effectiveBusinessPlan(business: {
  planName: string | null
  billingStatus: string
  launchEnrollment?: { cancelledAt: Date | null } | null
}, isSuperAdmin = false): BusinessPlan {
  if (isSuperAdmin) return 'PRO'
  if (business.launchEnrollment && !business.launchEnrollment.cancelledAt) return 'PRO'
  if (business.planName?.trim().toUpperCase() === 'PRO') return 'PRO'
  if (business.billingStatus === 'GRATUIT' || business.planName?.trim().toUpperCase() === 'FREE') return 'FREE'
  return 'STANDARD'
}

export function hasBusinessPlan(current: BusinessPlan, required: BusinessPlan) {
  return PLAN_RANK[current] >= PLAN_RANK[required]
}
