'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, Settings2, X } from 'lucide-react'
import { COOKIE_CONSENT_CHANGED_EVENT, COOKIE_CONSENT_KEY, COOKIE_PREFERENCES_OPEN_EVENT, readCookieConsent, type CookieConsentValue } from '@/lib/cookie-consent'
import { usePathname } from 'next/navigation'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [functional, setFunctional] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const pathname = usePathname()
  const inDashboard = pathname?.startsWith('/dashboard') || pathname?.startsWith('/superadmin')
  const onSignup = pathname === '/signup'

  useEffect(() => {
    // Înrolarea pornește doar cu stocarea esențială. Alegerea funcțională rămâne
    // accesibilă din linkul de sub formular, fără a acoperi câmpurile pe mobil.
    setVisible(!readCookieConsent() && !onSignup)
    const openPreferences = () => {
      const saved = readCookieConsent()
      setFunctional(saved?.functional ?? false)
      setMarketing(saved?.marketing ?? false)
      setVisible(true)
    }
    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPreferences)
    return () => window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, openPreferences)
  }, [onSignup])

  function save(nextFunctional: boolean, nextMarketing: boolean) {
    const consent: CookieConsentValue = { essential: true, functional: nextFunctional, marketing: nextMarketing, version: 2, savedAt: new Date().toISOString() }
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
      if (!nextFunctional) localStorage.removeItem('bookeasy_customer_info')
    } catch {}
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: consent }))
    setVisible(false)
  }

  if (!visible) return null

  if (onSignup) return (
    <div className="screen-only fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-[110] mx-auto max-w-md rounded-2xl border border-[var(--border-soft)] bg-white p-3 shadow-xl" role="dialog" aria-label="Preferințe cookie-uri">
      <button type="button" onClick={() => setVisible(false)} className="absolute right-3 top-2 text-gray-500 hover:text-gray-700" aria-label="Închide"><X size={16} /></button>
      <p className="pr-6 text-sm font-semibold text-[var(--brand-ink)]">Preferințe de stocare</p>
      <p className="mt-1 pr-3 text-xs leading-snug text-gray-600">Statistica agregată nu folosește cookie-uri. Meta Pixel se activează doar cu acordul tău. <Link href="/legal/cookies" className="font-semibold text-[var(--brand-teal-dark)] underline">Detalii</Link></p>
      <label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" checked={functional} onChange={event => setFunctional(event.target.checked)} />Memorează preferințele funcționale</label>
      <label className="mt-1 flex items-start gap-2 text-xs"><input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} />Permite măsurarea reclamelor prin Meta Pixel</label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => save(false, false)} className="btn-secondary min-h-10 !px-2 !py-2 text-xs">Fără opționale</button>
        <button type="button" onClick={() => save(functional, marketing)} className="btn-primary min-h-10 !px-2 !py-2 text-xs">Salvează alegerea</button>
      </div>
    </div>
  )

  return (
    <div className={'screen-only fixed inset-x-3 z-[110] mx-auto max-w-2xl rounded-[22px] border border-[var(--border-soft)] bg-white p-4 shadow-2xl sm:p-5 ' + (inDashboard ? 'bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-3' : 'bottom-3')} role="dialog" aria-label="Preferințe cookie-uri">
      <button type="button" onClick={() => setVisible(false)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-700" aria-label="Închide"><X size={17} /></button>
      <div className="flex items-start gap-3 pr-7">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-teal-soft)] text-[var(--brand-teal-dark)]"><Cookie size={19} /></span>
        <div>
          <p className="font-semibold text-[var(--brand-ink)]">Preferințe pentru site</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 sm:text-sm">Sesiunea este necesară. Analiza anonimă Vercel și contoarele agregate ne arată vizitele și pașii de înscriere fără cookie-uri. Meta Pixel măsoară reclamele numai dacă îl accepți.</p>
          <Link href="/legal/cookies" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-teal-dark)] hover:underline"><Settings2 size={13} /> Detalii și politica de cookie-uri</Link>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" checked={functional} onChange={event => setFunctional(event.target.checked)} />Memorarea preferințelor funcționale</label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} />Măsurarea reclamelor prin Meta Pixel</label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => save(false, false)} className="btn-secondary w-full">Fără opționale</button>
        <button type="button" onClick={() => save(functional, marketing)} className="btn-primary w-full">Salvează alegerea</button>
      </div>
    </div>
  )
}
