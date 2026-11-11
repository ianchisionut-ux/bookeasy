// Initial Wallet rollout: non-sensitive reservations where a pass or entry QR
// provides a useful customer-facing check-in or appointment confirmation.
const WALLET_CATEGORIES = new Set([
  'SALON', 'COAFURA_FRIZERIE', 'BARBER_SHOP', 'COSMETICA', 'NAILS',
  'LASHES', 'MAKE_UP', 'EPILARE', 'MASAJ', 'SPA_WELLNESS',
  'ESTETICA_REMODELARE', 'TATUAJE_PIERCING', 'STUDIO_BEAUTY',
  'FITNESS', 'SPORT_BAZE', 'CURSURI', 'LOC_JOACA', 'ACCES_CLUB',
  'EVENT_VENUE', 'MEDITATII', 'LIMBI_STRAINE', 'VETERINAR',
  'SERVICE_AUTO', 'DETAILING_AUTO',
])

export function isWalletEligibleCategory(category: string | null | undefined) {
  return Boolean(category && WALLET_CATEGORIES.has(category))
}
