'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SmsBusinessToggle({ initial, businessId }: { initial: boolean; businessId?: string }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function toggle() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/business/integrations/sms-gateway', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled, ...(businessId ? { businessId } : {}) }) })
      const data = await response.json()
      if (!response.ok) throw Error(data.error || 'Salvarea a eșuat.')
      setEnabled(!enabled)
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.') }
    finally { setBusy(false) }
  }
  return <section className="rounded-2xl border border-[var(--border-soft)] bg-white p-4"><div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">Trimitere SMS</h3><p className="mt-1 text-xs text-gray-500">Permite trimiterea mesajelor SMS pentru reconfirmări și remindere.</p></div><button type="button" role="switch" aria-label="Trimitere SMS" aria-checked={enabled} disabled={busy} onClick={toggle} className={`relative h-7 w-12 shrink-0 rounded-full disabled:opacity-50 ${enabled ? 'bg-[var(--accent)]' : 'bg-gray-200'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm ${enabled ? 'left-6' : 'left-1'}`} /></button></div>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</section>
}
