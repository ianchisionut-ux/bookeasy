'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, Settings2, X } from 'lucide-react'
import { COOKIE_CONSENT_KEY, COOKIE_PREFERENCES_OPEN_EVENT, readCookieConsent, type CookieConsentValue } from '@/lib/cookie-consent'
import { usePathname } from 'next/navigation'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const inDashboard = pathname?.startsWith('/dashboard') || pathname?.startsWith('/superadmin')

  useEffect(() => {
    setVisible(!readCookieConsent())
    const openPreferences = () => setVisible(true)
    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPreferences)
    return () => window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPreferences)
  }, [])

  function save(functional: boolean) {
    const consent: CookieConsentValue = { essential: true, functional, version: 1, savedAt: new Date().toISOString() }
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
      if (!functional) localStorage.removeItem('bookeasy_customer_info')
    } catch {}
    window.dispatchEvent(new CustomEvent('bookeasy:cookie-consent', { detail: consent }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={'screen-only fixed inset-x-3 z-[110] mx-auto max-w-2xl rounded-[22px] border border-[var(--border-soft)] bg-white p-4 shadow-2xl sm:p-5 ' + (inDashboard ? 'bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-3' : 'bottom-3')} role="dialog" aria-label="Preferințe cookie-uri">
      <button type="button" onClick={() => setVisible(false)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-700" aria-label="Închide"><X size={17} /></button>
      <div className="flex items-start gap-3 pr-7">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-teal-soft)] text-[var(--brand-teal-dark)]"><Cookie size={19} /></span>
        <div>
          <p className="font-semibold text-[var(--brand-ink)]">Folosim stocare locală esențială și funcțională</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 sm:text-sm">Sesiunea de autentificare este necesară funcționării. Cu acordul tău, putem memora local preferințe precum datele completate pentru o rezervare. Nu folosim cookie-uri publicitare.</p>
          <Link href="/legal/cookies" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-teal-dark)] hover:underline"><Settings2 size={13} /> Detalii și politica de cookie-uri</Link>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => save(false)} className="btn-secondary w-full">Doar esențiale</button>
        <button type="button" onClick={() => save(true)} className="btn-primary w-full">Acceptă funcționale</button>
      </div>
    </div>
  )
}
