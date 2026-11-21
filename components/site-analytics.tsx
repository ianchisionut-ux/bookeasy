'use client'

import { Analytics } from '@vercel/analytics/next'
import { useEffect, useState } from 'react'
import { COOKIE_CONSENT_CHANGED_EVENT, readCookieConsent } from '@/lib/cookie-consent'

const publicPaths = /^\/(?:|descopera(?:\/[a-z0-9-]+)?|harta|pentru-afaceri|contact|signup)$/

export default function SiteAnalytics() {
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

  if (!allowed) return null
  return <Analytics beforeSend={event => {
    if (readCookieConsent()?.analytics !== true) return null
    const url = new URL(event.url)
    if (!publicPaths.test(url.pathname)) return null
    const safe = new URL(url.pathname, url.origin)
    if (url.pathname === '/signup') {
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
        const value = url.searchParams.get(key)
        if (value && /^[A-Za-z0-9_-]{1,64}$/.test(value)) safe.searchParams.set(key, value)
      }
    }
    return { ...event, url: safe.toString() }
  }} />
}
