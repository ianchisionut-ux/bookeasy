'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function RestoreCustomerButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function restore() {
    setBusy(true)
    setError('')
    try {
      const response = await fetchWithTimeout(`/api/customers/${id}`, { method: 'POST' })
      if (!response.ok) throw new Error('Restaurarea a eșuat.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restaurarea a eșuat.')
      setBusy(false)
    }
  }
  return <><button type="button" className="text-[var(--accent)]" disabled={busy} onClick={restore}>{busy ? 'Se restaurează...' : 'Restaurează'}</button>{error && <span role="alert" className="text-red-600 ml-2">{error}</span>}</>
}
