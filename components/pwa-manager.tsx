'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Download, Share, WifiOff, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosInstallable, setIosInstallable] = useState(false)
  const [online, setOnline] = useState(true)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const wasDismissed = sessionStorage.getItem('bookeasy-install-dismissed') === '1'
    setIosInstallable(ios && !standalone)
    setDismissed(wasDismissed)

    if ('serviceWorker' in navigator) {
      const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
          console.error('[pwa] Service worker registration failed:', error)
        })
      const requestIdle = (window as Window & { requestIdleCallback?: typeof window.requestIdleCallback }).requestIdleCallback
      if (requestIdle) {
        requestIdle(register, { timeout: 3000 })
      } else {
        globalThis.setTimeout(register, 1500)
      }
    }

    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setDismissed(sessionStorage.getItem('bookeasy-install-dismissed') === '1')
    }
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }

  function dismiss() {
    sessionStorage.setItem('bookeasy-install-dismissed', '1')
    setDismissed(true)
  }

  const showInstallCard = online && !dismissed && Boolean(installPrompt || iosInstallable)

  return (
    <>
      {!online && (
        <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm text-white shadow-lg" role="status">
          <WifiOff size={15} /> Ești offline. Modificările necesită internet.
        </div>
      )}
      {showInstallCard && (
        <div className="fixed left-3 right-3 bottom-3 sm:left-auto sm:right-5 sm:w-96 z-[99] card p-4 shadow-xl border border-[var(--border-soft)]" role="dialog" aria-label="Instalează BookEasy">
          <button onClick={dismiss} className="absolute right-3 top-3 text-gray-400" aria-label="Închide"><X size={17} /></button>
          <div className="flex items-start gap-3 pr-6">
            <Image src="/icon-192.png" width={44} height={44} alt="" className="h-11 w-11 rounded-xl" />
            <div>
              <p className="font-medium">Instalează BookEasy</p>
              {installPrompt ? (
                <p className="text-xs text-gray-500 mt-0.5">Acces rapid din ecranul principal, ca o aplicație.</p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Share size={13} /> În Safari: Partajează → Adăugați la ecranul principal.</p>
              )}
            </div>
          </div>
          {installPrompt && <button onClick={install} className="btn-primary w-full mt-3 flex items-center justify-center gap-2"><Download size={16} /> Instalează aplicația</button>}
        </div>
      )}
    </>
  )
}
