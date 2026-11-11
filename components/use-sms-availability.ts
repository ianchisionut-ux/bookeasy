'use client'

import { useEffect, useState } from 'react'

export function useSmsAvailability(initialAvailable: boolean) {
  const [available, setAvailable] = useState(initialAvailable)

  useEffect(() => { setAvailable(initialAvailable) }, [initialAvailable])

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const response = await fetch('/api/business/integrations/sms-status', { cache: 'no-store' })
        if (!response.ok) throw new Error('SMS unavailable')
        const data = await response.json()
        if (active) setAvailable(data.online === true)
      } catch {
        if (active) setAvailable(false)
      }
    }
    void refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 30_000)
    window.addEventListener('focus', refresh)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  return available
}
