export function canPreviewBusiness(businessId: string, session: unknown): boolean {
  if (!session || typeof session !== 'object' || !('role' in session)) return false
  return session.role === 'SUPER_ADMIN' || (session.role === 'OWNER' && 'businessId' in session && session.businessId === businessId)
}

export function businessSetupHref(done: boolean, step: number): string {
  return done ? '/dashboard/setari#settings-visibility' : `/onboarding/step-${Math.max(1, Math.min(5, Math.trunc(step) || 1))}`
}
