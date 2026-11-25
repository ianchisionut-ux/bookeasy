'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { COOKIE_CONSENT_CHANGED_EVENT, readCookieConsent } from '@/lib/cookie-consent'

const publicPaths = /^\/(?:|descopera(?:\/[a-z0-9-]+)?|harta|pentru-afaceri|contact|signup)$/

export default function SiteAnalytics() {
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    const update = () => setAllowed(readCookieConsent()?.analytics === true)
    update()
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  useEffect(() => {
    if (!allowed || !publicPaths.test(pathname ?? '')) return
    let cancelled = false
    let script: HTMLScriptElement | null = null

    void fetch('/api/site-analytics/config', { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ token?: string }> : null)
      .then(config => {
        if (cancelled || readCookieConsent()?.analytics !== true || !config?.token || !/^[a-f0-9]{32,64}$/i.test(config.token)) return
        script = document.createElement('script')
        script.type = 'module'
        script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
        script.setAttribute('data-cf-beacon', JSON.stringify({ token: config.token, spa: false }))
        script.setAttribute('data-bookeasy-analytics', 'true')
        document.body.appendChild(script)
      })
      .catch(() => { /* Analytics never blocks the site. */ })

    return () => {
      cancelled = true
      script?.remove()
    }
  }, [allowed, pathname])

  return null
}
