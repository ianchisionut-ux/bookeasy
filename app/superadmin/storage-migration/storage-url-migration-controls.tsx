'use client'

import { useRef, useState } from 'react'

type Mode = 'check' | 'rewrite'
type Counts = {
  examined: number
  ready: number
  rewritten: number
  sourceUnavailable: number
  destinationMissing: number
  unsupported: number
  changedDuringMigration: number
}
type Batch = Counts & {
  hasMore: boolean
  nextCursor: string | null
  error?: string
  unmatchedByField?: Record<string, { sourceUnavailable: number; destinationMissing: number; unsupported: number }>
}
type Audit = { total: number; byField: Record<string, number>; error?: string }

const empty: Counts = {
  examined: 0, ready: 0, rewritten: 0, sourceUnavailable: 0,
  destinationMissing: 0, unsupported: 0, changedDuringMigration: 0,
}

export default function StorageUrlMigrationControls() {
  const [audit, setAudit] = useState<Audit | null>(null)
  const [counts, setCounts] = useState<Counts>(empty)
  const [unmatched, setUnmatched] = useState<Record<string, { sourceUnavailable: number; destinationMissing: number; unsupported: number }>>({})
  const [running, setRunning] = useState<Mode | null>(null)
  const [message, setMessage] = useState('Începe după copierea și verificarea completă a fișierelor.')
  const stopped = useRef(false)

  async function refresh() {
    const response = await fetch('/api/superadmin/storage-url-migration', { cache: 'no-store' })
    const data = await response.json() as Audit
    if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`)
    setAudit(data)
  }

  async function inspect() {
    try { await refresh(); setMessage('Inventarul referințelor este actualizat.') }
    catch (error) { setMessage(`Inventarul a eșuat: ${error instanceof Error ? error.message : 'eroare necunoscută'}.`) }
  }

  async function start(mode: Mode) {
    if (running) return
    stopped.current = false
    setRunning(mode)
    setCounts(empty)
    setUnmatched({})
    setMessage(mode === 'check' ? 'Verific referințele și obiectele R2…' : 'Actualizez referințele verificate…')
    let cursor: string | undefined
    const totals = { ...empty }
    const perField: Record<string, { sourceUnavailable: number; destinationMissing: number; unsupported: number }> = {}
    try {
      for (;;) {
        if (stopped.current) { setMessage('Oprit după ultimul lot complet.'); break }
        const response = await fetch('/api/superadmin/storage-url-migration', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, limit: 3, ...(cursor ? { cursor } : {}) }), cache: 'no-store',
        })
        const data = await response.json() as Batch
        if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`)
        for (const field of Object.keys(totals) as (keyof Counts)[]) totals[field] += data[field]
        for (const [field, values] of Object.entries(data.unmatchedByField || {})) {
          const sum = perField[field] ??= { sourceUnavailable: 0, destinationMissing: 0, unsupported: 0 }
          sum.sourceUnavailable += values.sourceUnavailable
          sum.destinationMissing += values.destinationMissing
          sum.unsupported += values.unsupported
        }
        setCounts({ ...totals })
        setUnmatched({ ...perField })
        if (!data.hasMore) {
          await refresh()
          setMessage(mode === 'check' ? 'Verificarea s-a încheiat.' : 'Actualizarea s-a încheiat; verifică referințele rămase.')
          break
        }
        if (!data.nextCursor || data.nextCursor === cursor) throw new Error('Cursor invalid; operațiunea a fost oprită.')
        cursor = data.nextCursor
      }
    } catch (error) {
      setMessage(`Operațiunea s-a oprit: ${error instanceof Error ? error.message : 'eroare necunoscută'}.`)
    } finally {
      setRunning(null)
    }
  }

  return <section className="mt-10 border-t border-slate-200 pt-8">
    <h2 className="mb-2 text-xl font-semibold">Referințe din baza de date</h2>
    <p className="mb-4">Schimbă adresele vechi doar pentru obiectele copiate și verificate în R2. Verifică inventarul înainte și după actualizare.</p>
    <div className="mb-4 flex flex-wrap gap-3">
      <button type="button" disabled={Boolean(running)} onClick={() => void inspect()} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Inventar adrese</button>
      <button type="button" disabled={Boolean(running)} onClick={() => void start('check')} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50">Verifică în R2</button>
      <button type="button" disabled={Boolean(running)} onClick={() => void start('rewrite')} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">Actualizează adresele</button>
      <button type="button" disabled={!running} onClick={() => { stopped.current = true }} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Oprește după lot</button>
    </div>
    <p role="status" className="mb-3 font-medium">{message}</p>
    {audit && <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <strong>Adrese vechi rămase: {audit.total}</strong>
      <ul className="mt-2 list-inside list-disc">{Object.entries(audit.byField).filter(([, count]) => count > 0).map(([field, count]) => <li key={field}>{field}: {count}</li>)}</ul>
    </div>}
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
      {Object.entries(counts).map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
    </dl>
    {Object.keys(unmatched).length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <strong>Referințe care cer verificare manuală</strong>
      <ul className="mt-2 list-inside list-disc">{Object.entries(unmatched).map(([field, value]) => <li key={field}>{field}: sursă indisponibilă {value.sourceUnavailable}, lipsă în R2 {value.destinationMissing}, format necunoscut {value.unsupported}</li>)}</ul>
    </div>}
  </section>
}
