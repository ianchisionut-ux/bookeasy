'use client'

import { COOKIE_PREFERENCES_OPEN_EVENT } from '@/lib/cookie-consent'

export function CookiePreferencesButton({ className = '', onOpen }: { className?: string; onOpen?: () => void }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onOpen?.()
        window.dispatchEvent(new Event(COOKIE_PREFERENCES_OPEN_EVENT))
      }}
    >
      Setări cookie-uri
    </button>
  )
}
