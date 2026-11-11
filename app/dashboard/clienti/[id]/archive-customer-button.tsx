'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function ArchiveCustomerButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function archive() {
    if (!window.confirm(`Elimini ${label} din lista activă? Istoricul și documentele rămân păstrate și îl poți recupera din Arhivă.`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetchWithTimeout(`/api/customers/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Nu am putut elimina fișa. Încearcă din nou.')
      router.push('/dashboard/clienti')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nu am putut elimina fișa.')
      setBusy(false)
    }
  }

  return <div className="screen-only"><button type="button" onClick={archive} disabled={busy} className="btn-secondary text-sm text-red-600">{busy ? 'Se elimină...' : `Elimină ${label}`}</button>{error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}</div>
}
