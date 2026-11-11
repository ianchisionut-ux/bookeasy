'use client'

import { useState } from 'react'

export default function CheckInButton({ code }: { code: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  async function confirm() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/business/wallet/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Nu am putut înregistra sosirea.')
      setDone(true)
      setMessage('Sosirea a fost înregistrată.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nu am putut înregistra sosirea.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="mt-6"><button type="button" className="btn-primary" disabled={busy || done} onClick={() => void confirm()}>{busy ? 'Se verifică...' : done ? 'Check-in finalizat' : 'Confirmă sosirea'}</button>{message && <p role="status" className="mt-3 text-sm">{message}</p>}</div>
}
