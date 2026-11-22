'use client'
import { useEffect, useState } from 'react'

type Snapshot = { online: boolean; lastError: string | null; jobs: { id: string; recipient: string; status: string; provider: string | null; message: string; kind: string; createdAt: string }[] }
const failedStatuses = ['FAILED', 'UNKNOWN', 'EXPIRED', 'RETIRED']
const labels: Record<string, string> = { PENDING: 'În așteptare', DISPATCHED: 'În curs de trimitere', SENT: 'Predat operatorului', FAILED: 'Eșuat', UNKNOWN: 'Rezultat necunoscut', EXPIRED: 'Expirat', RETIRED: 'Netrimis' }

function jobLabel(job: Snapshot['jobs'][number]) {
  if (job.provider === 'smsapi' && job.status === 'SENT') return 'Acceptat de SMSAPI'
  if (job.provider === 'smsapi' && job.status === 'DISPATCHED') return 'În procesare la SMSAPI'
  return labels[job.status] || job.status
}

export default function SmsGatewayActivity() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function refresh() {
      if (pending || document.visibilityState !== 'visible') return
      pending = true
      try {
        const response = await fetch('/api/superadmin/sms', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Starea serviciului SMS nu a putut fi verificată.')
        const data = await response.json()
        if (!controller.signal.aborted) { setSnapshot(data); setError('') }
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Verificarea a eșuat.') }
      finally { pending = false }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const latest = snapshot?.jobs[0]
  const connected = Boolean(snapshot?.online && !error)
  const time = (value: string) => new Date(value).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
  const badge = (status: string) => failedStatuses.includes(status) ? 'bg-red-50 text-red-700' : status === 'SENT' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'

  return <div className="border-t border-[var(--border-soft)] pt-4">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-sm font-medium">Stare SMS</h4>
      {snapshot && <span role="status" className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-700' : 'text-amber-800'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />{error ? 'Stare neverificată' : connected ? 'SMSAPI activ' : 'SMSAPI indisponibil'}</span>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {snapshot?.lastError && <p role="alert" className="mt-2 text-xs text-red-700">{snapshot.lastError}</p>}
    {snapshot ? <>
      {latest && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs"><span className="text-gray-600">Ultimul SMS</span><span className={`rounded-full px-2 py-1 text-[11px] ${badge(latest.status)}`}>{jobLabel(latest)}</span></div>}
      {snapshot.jobs.length > 0 ? <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-[var(--accent-hover)]">Vezi istoricul SMS ({snapshot.jobs.length})</summary>
        <div role="region" aria-label="Istoric SMS" tabIndex={0} className="mt-3 max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {snapshot.jobs.map(job => <div key={job.id} className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs">
            <div className="flex items-start justify-between gap-2"><span className="font-medium">{job.kind} · {job.recipient}</span><time className="shrink-0 text-[10px] text-gray-400" dateTime={job.createdAt}>{time(job.createdAt)}</time></div>
            <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] ${badge(job.status)}`}>{jobLabel(job)}</span>
            {failedStatuses.includes(job.status) && <p className="mt-1.5 leading-relaxed text-gray-600">{job.message}</p>}
          </div>)}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">Starea afișată indică preluarea mesajului pentru expediere. Livrarea se verifică separat.</p>
      </details> : <p className="mt-2 text-xs text-gray-500">Nu există SMS-uri înregistrate.</p>}
    </> : !error && <p className="mt-2 text-xs text-gray-500">Se verifică starea…</p>}
  </div>
}
