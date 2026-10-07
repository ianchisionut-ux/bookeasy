'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { CLIENT_INSTALL_DISMISSED_KEY, CLIENT_INSTALLED_KEY, isStandaloneApp } from '@/lib/client-pwa'

export default function ClientInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const refresh = () => {
      try {
        setVisible(!isStandaloneApp() && localStorage.getItem(CLIENT_INSTALL_DISMISSED_KEY) !== '1' && localStorage.getItem(CLIENT_INSTALLED_KEY) !== '1')
      } catch {
        setVisible(!isStandaloneApp())
      }
    }
    refresh()
    const installed = () => {
      try { localStorage.setItem(CLIENT_INSTALLED_KEY, '1') } catch { /* Storage may be disabled. */ }
      setVisible(false)
    }
    window.addEventListener('appinstalled', installed)
    window.addEventListener('bookeasy-app-installed', installed)
    return () => {
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('bookeasy-app-installed', installed)
    }
  }, [])

  if (!visible) return null

  return (
    <section className="mx-auto mb-10 max-w-7xl px-4 sm:px-6" aria-label="Instalează BookEasy">
      <div className="relative flex flex-col items-start gap-5 overflow-hidden rounded-[24px] bg-gradient-to-r from-[var(--brand-teal-soft)] to-[var(--brand-green-soft)] p-6 pr-12 sm:flex-row sm:items-center sm:justify-between sm:p-8 sm:pr-16">
        <button type="button" onClick={() => { try { localStorage.setItem(CLIENT_INSTALL_DISMISSED_KEY, '1') } catch { /* Keep hidden until reload. */ } setVisible(false) }} aria-label="Închide bannerul de instalare" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-[var(--brand-ink)] hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal-dark)]"><X size={20} /></button>
        <div><h2 className="text-2xl font-bold tracking-tight">BookEasy în buzunarul tău</h2><p className="mt-1 text-sm text-gray-600">Instalează aplicația pentru clienți și revino rapid la locurile favorite.</p><div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-[var(--brand-teal-dark)]"><span>♡ Favorite pe telefon</span><span>▣ Rezervare rapidă</span><span>✓ Fără magazin de aplicații</span></div></div>
        <button type="button" onClick={() => window.dispatchEvent(new Event('bookeasy-install-request'))} className="btn-primary flex min-h-12 shrink-0 items-center gap-2 px-5 text-sm"><Smartphone size={19} /> Instalează aplicația</button>
      </div>
    </section>
  )
}
