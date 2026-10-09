'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Download, Share, WifiOff, X } from 'lucide-react'
import { CLIENT_INSTALL_DISMISSED_KEY, CLIENT_INSTALLED_KEY, isStandaloneApp } from '@/lib/client-pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneAppSafe() {
  return typeof window !== 'undefined' && isStandaloneApp()
}

export default function PwaManager() {
  const pathname = usePathname()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosInstallable, setIosInstallable] = useState(false)
  const [online, setOnline] = useState(true)
  const [dismissed, setDismissed] = useState(true)
  const [manualInstall, setManualInstall] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    const standalone = isStandaloneApp()
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const wasDismissed = sessionStorage.getItem('bookeasy-install-dismissed') === '1'
    setIosInstallable(ios && !standalone)
    setDismissed(wasDismissed)

    if ('serviceWorker' in navigator) {
      const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch((error) => {
          console.error('[pwa] Service worker registration failed:', error)
        })
      const requestIdle = (window as Window & { requestIdleCallback?: typeof window.requestIdleCallback }).requestIdleCallback
      if (requestIdle) {
        requestIdle(register, { timeout: 3000 })
      } else {
        globalThis.setTimeout(register, 1500)
      }
    }

    const onAppInstalled = () => {
      if (/^\/(descopera|harta)(\/|$)/.test(window.location.pathname)) {
        try { localStorage.setItem(CLIENT_INSTALLED_KEY, '1') } catch { /* Storage may be disabled. */ }
      }
      setInstallPrompt(null)
      setManualInstall(false)
      setDismissed(true)
      window.dispatchEvent(new Event('bookeasy-app-installed'))
    }
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setDismissed(sessionStorage.getItem('bookeasy-install-dismissed') === '1')
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('appinstalled', onAppInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const onInstallRequest = () => {
      if (isStandaloneApp()) return
      if (installPrompt) void install()
      else { setManualInstall(true); setDismissed(false) }
    }
    window.addEventListener('bookeasy-install-request', onInstallRequest)
    return () => window.removeEventListener('bookeasy-install-request', onInstallRequest)
  }, [installPrompt])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }

  function dismiss() {
    if (isClientPage) {
      try { localStorage.setItem(CLIENT_INSTALL_DISMISSED_KEY, '1') } catch { /* Storage may be disabled. */ }
    } else {
      sessionStorage.setItem('bookeasy-install-dismissed', '1')
    }
    setDismissed(true)
  }

  const isClientPage = /^\/(descopera|harta)(\/|$)/.test(pathname) || /^\/[^/]+\/(rezerva|recenzie)(\/|$)/.test(pathname)
  const showInstallCard = online && !dismissed && !isStandaloneAppSafe() && (isClientPage ? manualInstall : Boolean(installPrompt || iosInstallable || manualInstall))

  return (
    <>
      {!online && (
        <div className="screen-only fixed left-1/2 bottom-4 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg" role="status">
          <WifiOff size={15} /> Ești offline. Modificările necesită internet.
        </div>
      )}
      {showInstallCard && (
        <div className={`screen-only fixed left-3 right-3 ${isClientPage ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))]' : 'bottom-3'} sm:bottom-3 sm:left-auto sm:right-5 sm:w-96 z-[99] card p-4 shadow-xl border border-[var(--border-soft)]`} role="dialog" aria-label="Instalează BookEasy">
          <button onClick={dismiss} className="absolute right-3 top-3 text-gray-400" aria-label="Închide"><X size={17} /></button>
          <div className="flex items-start gap-3 pr-6">
            <Image src="/pwa-icon-192-white-v2.png" width={44} height={44} alt="" className="h-11 w-11 rounded-xl" />
            <div>
              <p className="font-medium">Instalează {isClientPage ? 'BookEasy pentru clienți' : 'BookEasy'}</p>
              {installPrompt ? (
                <p className="text-xs text-gray-500 mt-0.5">Acces rapid din ecranul principal, ca o aplicație.</p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Share size={13} /> {iosInstallable ? 'În Safari: Partajează → Adăugați la ecranul principal.' : 'Din meniul browserului: Instalează aplicația sau Adaugă pe ecranul principal.'}</p>
              )}
            </div>
          </div>
          {installPrompt && <button onClick={install} className="btn-primary w-full mt-3 flex items-center justify-center gap-2"><Download size={16} /> Instalează aplicația</button>}
        </div>
      )}
    </>
  )
}
