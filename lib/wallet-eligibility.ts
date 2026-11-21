// Passes are useful at venues or activities where staff verify entry or attendance.
const WALLET_CATEGORIES = new Set([
  'EVENT_VENUE', 'SPORT_BAZE', 'FITNESS', 'CURSURI', 'LOC_JOACA', 'ACCES_CLUB',
])

export function isWalletEligibleCategory(category: string | null | undefined) {
  return Boolean(category && WALLET_CATEGORIES.has(category))
}
