'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MessengerBotToggle({
  channelId,
  enabled,
  channelName = 'Messenger',
  businessId,
}: {
  channelId: string
  enabled: boolean
  channelName?: 'Messenger' | 'Instagram'
  businessId?: string
}) {
  const [on, setOn] = useState(enabled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function toggle() {
    setBusy(true)
    setError('')
    const next = !on
    try {
      const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : ''
      const response = await fetch(`/api/business/channels/${channelId}/toggle${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledByOwner: next }),
      })
      if (!response.ok) throw new Error(`Setarea botului ${channelName} nu a putut fi salvată.`)
      setOn(next)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Setarea botului ${channelName} nu a putut fi salvată.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Bot {channelName}</p>
          <p className="text-xs text-gray-500">
            {on
              ? `Răspunde automat pe ${channelName}. Conversația apare în Mesaje numai după ce clientul apasă „Operator”.`
              : 'Oprit: botul nu răspunde, iar conversațiile noi nu apar în BookEasy fără o cerere „Operator”.'}
          </p>
        </div>
        <button type="button" role="switch" aria-label={`Bot ${channelName}`} aria-checked={on} onClick={toggle} disabled={busy}
          className="relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50"
          style={{ background: on ? 'var(--accent)' : '#d1d5db' }}>
          <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: on ? 'translateX(24px)' : 'translateX(0)' }} />
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">Conexiunea rămâne activă. Răspunsurile și reconfirmările manuale rămân disponibile.</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
