export const COOKIE_CONSENT_KEY = 'bookeasy_cookie_consent_v2'
export const COOKIE_PREFERENCES_OPEN_EVENT = 'bookeasy:open-cookie-preferences'
export const COOKIE_CONSENT_CHANGED_EVENT = 'bookeasy:cookie-consent'

export type CookieConsentValue = {
  essential: true
  functional: boolean
  marketing: boolean
  version: 2
  savedAt: string
}

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_KEY) ?? 'null') as Partial<CookieConsentValue> | null
    if (stored?.version !== 2 || stored.essential !== true || typeof stored.functional !== 'boolean' || typeof stored.marketing !== 'boolean') return null
    return stored as CookieConsentValue
  } catch {
    return null
  }
}

export function hasFunctionalConsent() {
  return readCookieConsent()?.functional === true
}

export function hasMarketingConsent() {
  return readCookieConsent()?.marketing === true
}
