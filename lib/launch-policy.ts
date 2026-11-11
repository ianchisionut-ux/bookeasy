export const LAUNCH_CAMPAIGN_ID = 'bookeasy-launch-2026'
export const LAUNCH_OFFER_VERSION = '2026-10-lansare2-code'
export const LAUNCH_PROMO_CODE = 'Lansare2'
export function isLaunchPromoCode(value: string) {
  return value.trim().toLowerCase() === LAUNCH_PROMO_CODE.toLowerCase()
}
export const LAUNCH_OFFER = { freeMonths: 2, promoMonths: 0, promoMinor: 0, regularMinor: 5500 } as const
export type LaunchTerms = { freeMonths: number; promoMonths: number; promoMinor: number; regularMinor: number }
export type LaunchState = LaunchTerms & { activatedAt: Date | null; cancelledAt: Date | null }

// Always calculate from the original anniversary, so Jan 31 -> Feb 28 -> Mar 31.
// Use UTC explicitly to make server and scheduler timezone independent.
export function launchMonth(anchor: Date, months: number) {
  const result = new Date(anchor)
  result.setUTCDate(1)
  result.setUTCMonth(anchor.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(anchor.getUTCDate(), lastDay))
  return result
}

export function launchCycle(anchor: Date, now: Date) {
  let cycle = Math.max(0, (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth())
  if (cycle > 0 && now < launchMonth(anchor, cycle)) cycle--
  return cycle
}

export function launchPrice(terms: LaunchTerms, cycle: number) {
  return cycle < terms.freeMonths ? 0 : cycle < terms.freeMonths + terms.promoMonths ? terms.promoMinor : terms.regularMinor
}

export function launchView(enrollment: LaunchState, now = new Date()) {
  const anchor = enrollment.activatedAt
  const cycle = anchor ? launchCycle(anchor, now) : 0
  const currentMinor = anchor ? launchPrice(enrollment, cycle) : 0
  return {
    stage: enrollment.cancelledAt ? 'MANUAL' : !anchor ? 'ONBOARDING' : currentMinor === 0 ? 'FREE' : cycle < enrollment.freeMonths + enrollment.promoMonths ? 'PROMO' : 'STANDARD',
    cycle,
    currentMinor,
    nextMinor: anchor ? launchPrice(enrollment, cycle + 1) : 0,
    nextAt: anchor ? launchMonth(anchor, cycle + 1).toISOString() : null,
    freeEndsAt: anchor ? launchMonth(anchor, enrollment.freeMonths).toISOString() : null,
    promoEndsAt: anchor ? launchMonth(anchor, enrollment.freeMonths + enrollment.promoMonths).toISOString() : null,
  }
}

export const LAUNCH_STAGE_LABEL: Record<string, string> = { ONBOARDING: 'În configurare', FREE: 'Perioadă gratuită', PROMO: 'Ofertă anterioară', STANDARD: 'Tarif standard', MANUAL: 'Facturare manuală' }

export function isCurrentLaunchOffer(terms: LaunchTerms) {
  return terms.freeMonths === LAUNCH_OFFER.freeMonths && terms.promoMonths === LAUNCH_OFFER.promoMonths && terms.promoMinor === LAUNCH_OFFER.promoMinor && terms.regularMinor === LAUNCH_OFFER.regularMinor
}

export function launchAdminSummary(enrollment: LaunchState, now = new Date()) {
  const view = launchView(enrollment, now)
  if (view.stage === 'MANUAL') return 'Facturare manuală'
  if (view.stage === 'ONBOARDING') return enrollment.freeMonths + ' luni gratuite după configurare'
  const date = (value: string) => new Date(value).toLocaleDateString('ro-RO', {timeZone:'Europe/Bucharest'})
  if (view.stage === 'FREE' && view.freeEndsAt) return 'Gratuit până la ' + date(view.freeEndsAt)
  return view.currentMinor / 100 + ' lei · perioada începută la ' + date(launchMonth(enrollment.activatedAt!, view.cycle).toISOString())
}
