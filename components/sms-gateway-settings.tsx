'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { matchesSmsSim } from '@/lib/sms-policy'
import SmsGatewayActivity from '@/components/sms-gateway-activity'

type Initial = { apiUrl: string | null; hasApiKey: boolean; deviceId: number | null; phone: string | null; enabled: boolean; testedAt: string | Date | null; lastError: string | null; mode: string; paired: boolean; lastSeenAt: string | Date | null }
export default function SmsGatewaySettings({ initial }: { initial: Initial; central?: boolean }) {
  const router = useRouter()
  const [phone, setPhone] = useState(initial.phone || '')
  const [enabled, setEnabled] = useState(initial.enabled)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, 15000)
    return () => clearInterval(timer)
  }, [router])
  const saved = matchesSmsSim(phone, initial.phone) && enabled === initial.enabled
  async function submit(action: 'settings' | 'pair') {
    setBusy(true); setError(''); setMessage(''); setToken('')
    try {
      const response = await fetch('/api/superadmin/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'settings' ? { action, phone, enabled } : { action }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Configurarea nu a putut fi salvată.')
      if (action === 'pair') { setToken(data.token); setMessage('Copiază codul în telefonul Android dedicat. Codul nou înlocuiește asocierea anterioară.') }
      else setMessage('Setările gateway-ului central au fost salvate.')
      router.refresh()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Conexiunea a fost întreruptă.') }
    finally { setBusy(false) }
  }
  return <section className="card min-w-0 space-y-5 p-4 sm:p-6" aria-label="Gateway SMS central">
    <div><h2 className="text-lg font-semibold">Gateway SMS central BookEasy</h2><p className="mt-2 text-sm leading-relaxed text-gray-600">Un singur Android cu un singur SIM trimite reconfirmările și reminderele. Afacerile nu au nevoie de telefoane sau coduri proprii.</p></div>
    <div className="space-y-3 border-t border-[var(--border-soft)] pt-4">
      <h3 className="font-semibold">1. Numărul central</h3>
      <label className="grid gap-2 text-sm">Numărul SIM-ului<input type="tel" autoComplete="tel" className="input-field min-h-11 w-full min-w-0" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+40 712 345 678" /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Gateway central activ</label>
      <button type="button" className="btn-primary min-h-11 w-full whitespace-normal text-center sm:w-auto" disabled={busy} onClick={() => void submit('settings')}>{busy ? 'Se procesează…' : 'Salvează setările'}</button>
    </div>
    <div className="space-y-3 border-t border-[var(--border-soft)] pt-4">
      <h3 className="font-semibold">2. Telefonul Android dedicat</h3>
      <p className="text-sm leading-relaxed text-gray-600">Deschide Gateway SMS în aplicația Android, introdu codul de mai jos și selectează SIM-ul cu numărul salvat. Nu se folosește automat alt SIM.</p>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2"><a href="/downloads/bookeasy-android.apk" download className="btn-secondary flex min-h-11 items-center justify-center whitespace-normal text-center text-sm">Descarcă aplicația Android</a><a href="bookeasy://sms/setup" className="btn-secondary flex min-h-11 items-center justify-center whitespace-normal text-center text-sm">Deschide Gateway SMS</a></div>
      <button type="button" className="btn-secondary min-h-11 w-full whitespace-normal text-center" disabled={busy || !saved || !initial.enabled || !initial.phone} onClick={() => void submit('pair')}>{initial.paired ? 'Generează un cod nou de asociere' : 'Generează codul de asociere'}</button>
      {!saved && <p className="text-xs text-gray-500">Salvează setările înainte de asociere.</p>}
      {token && <div className="min-w-0 space-y-2"><label className="grid gap-2 text-sm">Cod de asociere · afișat o singură dată<textarea readOnly value={token} rows={3} className="input-field w-full min-w-0 break-all font-mono text-xs" onFocus={event => event.target.select()} /></label><button type="button" className="btn-secondary min-h-11 w-full sm:w-auto" onClick={async () => { try { await navigator.clipboard.writeText(token); setMessage('Cod copiat.') } catch { setError('Selectează și copiază codul manual.') } }}>Copiază codul</button></div>}
    </div>
    <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-xs leading-relaxed text-gray-600">Păstrează telefonul online, cu permisiunea SMS și rularea în fundal active. Se trimit doar SMS-uri text. Starea „Predat operatorului” nu confirmă livrarea la client.</div>
    {message && <p role="status" className="text-sm text-teal-800">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <SmsGatewayActivity central />
  </section>
}
