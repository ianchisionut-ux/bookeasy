'use client'
import { useEffect, useState } from 'react'

type Snapshot = { online: boolean; lastSeenAt: string | null; lastError: string | null; jobs: { id: string; recipient: string; status: string; message: string; kind: string; createdAt: string }[] }
const labels: Record<string, string> = { PENDING: 'În așteptare', DISPATCHED: 'Preluat de telefon', SENT: 'Predat operatorului', FAILED: 'Eșuat', UNKNOWN: 'Rezultat necunoscut', EXPIRED: 'Expirat' }

export default function SmsGatewayActivity({ businessId, central = false }: { businessId?: string; central?: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function refresh() {
      if (pending || document.visibilityState !== 'visible') return
      pending = true
      try {
        const response = await fetch(central ? '/api/superadmin/sms' : `/api/business/integrations/sms-status${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ''}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Starea telefonului nu a putut fi verificată.')
        const data = await response.json()
        if (!controller.signal.aborted) { setSnapshot(data); setError('') }
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Verificarea a eșuat.') }
      finally { pending = false }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [businessId, central])
  const latest = snapshot?.jobs[0]
  const connected = Boolean(snapshot?.online && !error)
  const time = (value: string) => new Date(value).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
  const badge = (status: string) => status === 'FAILED' || status === 'UNKNOWN' || status === 'EXPIRED' ? 'bg-red-50 text-red-700' : status === 'SENT' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'

  return <div className="border-t border-[var(--border-soft)] pt-4">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-sm font-medium">Stare SMS</h4>
      {snapshot && <span role="status" className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-700' : 'text-amber-800'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{error ? 'Stare neverificată' : connected ? 'Telefon conectat' : 'Telefon deconectat'}</span>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {snapshot?.lastError && <p role="alert" className="mt-2 text-xs text-red-700">{snapshot.lastError}</p>}
    {snapshot ? <>
      <p className="mt-1 text-[11px] text-gray-500">{snapshot.lastSeenAt ? `Ultimul contact: ${time(snapshot.lastSeenAt)}` : 'Încă nu există un contact verificat.'}{!connected && !error && ' Deschide Gateway SMS pe telefon.'}</p>
      {latest && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs"><span className="text-gray-600">Ultimul SMS</span><span className={`rounded-full px-2 py-1 text-[11px] ${badge(latest.status)}`}>{labels[latest.status] || latest.status}</span></div>}
      {snapshot.jobs.length > 0 ? <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-[var(--accent-hover)]">Vezi istoricul SMS ({snapshot.jobs.length})</summary>
        <div role="region" aria-label="Istoric SMS" tabIndex={0} className="mt-3 max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {snapshot.jobs.map(job => <div key={job.id} className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs">
            <div className="flex items-start justify-between gap-2"><span className="font-medium">{job.kind} · {job.recipient}</span><time className="shrink-0 text-[10px] text-gray-400" dateTime={job.createdAt}>{time(job.createdAt)}</time></div>
            <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] ${badge(job.status)}`}>{labels[job.status] || job.status}</span>
            {(job.status === 'FAILED' || job.status === 'UNKNOWN' || job.status === 'EXPIRED') && <p className="mt-1.5 leading-relaxed text-gray-600">{job.message}</p>}
          </div>)}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">„Predat operatorului” nu reprezintă o confirmare de livrare la client.</p>
      </details> : <p className="mt-2 text-xs text-gray-500">Nu există SMS-uri înregistrate.</p>}
    </> : !error && <p className="mt-2 text-xs text-gray-500">Se verifică starea…</p>}
  </div>
}
