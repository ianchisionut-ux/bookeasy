'use client'

import { Analytics } from '@vercel/analytics/next'

// Analytics is limited to public pages. Query strings elsewhere can contain
// verification tokens, email addresses, or OAuth state.
export default function SiteAnalytics() {
  return <Analytics beforeSend={event => {
    const url = new URL(event.url)
    if (/^\/(?:api|dashboard|superadmin|cont|verify-email|reset-password|login)(?:\/|$)/.test(url.pathname)) return null
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
