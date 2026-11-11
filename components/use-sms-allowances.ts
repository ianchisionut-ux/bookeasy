'use client'
import { useEffect, useState } from 'react'
import type { SmsAllowance } from '@/lib/sms-limits'

export function useSmsAllowances(ids: string[], enabled = true) {
  const key = [...new Set(ids)].sort().join(',')
  const [allowances, setAllowances] = useState<Record<string, SmsAllowance>>({})
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!key || !enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    async function load() {
      try {
        const all: Record<string, SmsAllowance> = {}
        const values = key.split(',')
        for (let index = 0; index < values.length; index += 100) {
          const r = await fetch(`/api/business/bookings/sms-limits?ids=${encodeURIComponent(values.slice(index, index + 100).join(','))}`, { signal: controller.signal, cache: 'no-store' })
          if (!r.ok) throw new Error('Limits unavailable')
          Object.assign(all, (await r.json()).allowances)
        }
        setAllowances(all)
      } catch { if (!controller.signal.aborted) setAllowances({}) }
      finally { clearTimeout(timer) }
    }
    void load()
    // Refresh when a cooldown ends or another dashboard tab sends a message.
    const interval = setInterval(() => { if (document.visibilityState === 'visible') setRevision(value => value + 1) }, 15_000)
    return () => { controller.abort(); clearTimeout(timer); clearInterval(interval) }
  }, [key, revision, enabled])
  return { allowances, refresh: () => setRevision(value => value + 1) }
}
