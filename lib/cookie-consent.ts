export const COOKIE_CONSENT_KEY = 'bookeasy_cookie_consent_v1'
export const COOKIE_PREFERENCES_OPEN_EVENT = 'bookeasy:open-cookie-preferences'

export type CookieConsentValue = {
  essential: true
  functional: boolean
  version: 1
  savedAt: string
}

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_KEY) ?? 'null') as Partial<CookieConsentValue> | null
    if (stored?.version !== 1 || stored.essential !== true || typeof stored.functional !== 'boolean') return null
    return stored as CookieConsentValue
  } catch {
    return null
  }
}

export function hasFunctionalConsent() {
  return readCookieConsent()?.functional === true
}
