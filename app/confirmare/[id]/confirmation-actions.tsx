'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CheckCircle2, XCircle } from 'lucide-react'

export default function ConfirmationActions({ bookingId, token, accent }: { bookingId: string; token: string; accent: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function act(action: 'CONFIRM' | 'RESCHEDULE' | 'CANCEL') {
    setBusy(action); setError('')
    try {
      const response = await fetch(`/api/public/bookings/${bookingId}/sms-confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (action === 'RESCHEDULE' && data.rebookUrl) { router.push(data.rebookUrl); return }
      setDone(action)
    } catch (err) { setError(err instanceof Error ? err.message : 'Răspunsul nu a putut fi înregistrat.') }
    finally { setBusy(null) }
  }

  if (done) return <div className="rounded-2xl bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={34} /><p className="font-semibold text-emerald-950">{done === 'CONFIRM' ? 'Programarea a fost confirmată.' : 'Programarea a fost anulată.'}</p><p className="mt-1 text-sm text-emerald-800">Afacerea vede imediat răspunsul tău în BookEasy.</p></div>
  return <div className="grid gap-3">
    <button type="button" disabled={Boolean(busy)} onClick={() => act('CONFIRM')} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 font-semibold text-white shadow-sm disabled:opacity-60" style={{ background: accent }}><CheckCircle2 size={20} />{busy === 'CONFIRM' ? 'Se confirmă…' : 'Confirm programarea'}</button>
    <button type="button" disabled={Boolean(busy)} onClick={() => act('RESCHEDULE')} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border bg-white px-5 font-semibold text-gray-800 disabled:opacity-60"><CalendarClock size={20} />{busy === 'RESCHEDULE' ? 'Se deschide…' : 'Doresc reprogramarea'}</button>
    <button type="button" disabled={Boolean(busy)} onClick={() => act('CANCEL')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-medium text-red-700 disabled:opacity-60"><XCircle size={18} />{busy === 'CANCEL' ? 'Se anulează…' : 'Anulează programarea'}</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
  </div>
}
