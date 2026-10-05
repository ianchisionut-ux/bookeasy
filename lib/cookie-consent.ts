export const COOKIE_CONSENT_KEY = 'bookeasy_cookie_consent_v1'

export type CookieConsentValue = {
  essential: true
  functional: boolean
  version: 1
  savedAt: string
}

export function hasFunctionalConsent() {
  if (typeof window === 'undefined') return false
  try {
    const stored = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_KEY) ?? 'null') as Partial<CookieConsentValue> | null
    return stored?.version === 1 && stored.functional === true
  } catch {
    return false
  }
}
