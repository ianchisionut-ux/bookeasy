'use client'

import { useRef, useState } from 'react'

type Mode = 'dry-run' | 'copy'
type Counts = { examined: number; deleted: number; missing: number; present: number; copied: number; verifiedExisting: number; verifiedBytes: number }
type BatchResult = Counts & { mode: Mode; hasMore: boolean; nextCursor: string | null; error?: string }

const empty: Counts = { examined: 0, deleted: 0, missing: 0, present: 0, copied: 0, verifiedExisting: 0, verifiedBytes: 0 }

export default function StorageMigrationControls() {
  const [running, setRunning] = useState<Mode | null>(null)
  const [counts, setCounts] = useState<Counts>(empty)
  const [batches, setBatches] = useState(0)
  const [message, setMessage] = useState('Pregătit. Începe cu verificarea inventarului.')
  const cancelled = useRef(false)

  async function start(mode: Mode) {
    if (running) return
    cancelled.current = false
    setRunning(mode)
    setCounts(empty)
    setBatches(0)
    setMessage(mode === 'copy' ? 'Copiere și verificare în curs…' : 'Inventariere în curs…')
    let cursor: string | undefined
    let page = 0
    const sum = { ...empty }
    try {
      for (;;) {
        if (cancelled.current) { setMessage('Oprit după ultimul lot complet.'); break }
        const response = await fetch('/api/superadmin/storage-migration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, limit: 2, ...(cursor ? { cursor } : {}) }),
          cache: 'no-store',
        })
        const result = await response.json() as BatchResult
        if (!response.ok || result.error) throw new Error(`${result.error || `HTTP ${response.status}`} (lotul ${page + 1})`)
        for (const key of Object.keys(sum) as (keyof Counts)[]) sum[key] += result[key]
        page++
        setBatches(page)
        setCounts({ ...sum })
        if (!result.hasMore) { setMessage(mode === 'copy' ? 'Copiere completă și verificată.' : 'Inventariere completă.'); break }
        if (!result.nextCursor || result.nextCursor === cursor) throw new Error('Cursor invalid; transferul a fost oprit.')
        cursor = result.nextCursor
      }
    } catch (error) {
      setMessage(`Eroare: ${error instanceof Error ? error.message : 'necunoscută'}. Oprit; verifică înainte de reluare.`)
    } finally {
      setRunning(null)
    }
  }

  return <main className="mx-auto max-w-3xl p-6 text-sm text-slate-800">
    <h1 className="mb-3 text-2xl font-semibold">Migrare fișiere BookEasy</h1>
    <p className="mb-5">Transfer temporar din depozitul vechi în Cloudflare R2. Fișierele sursă nu se șterg. Oprește transferul dacă apare o eroare.</p>
    <div className="mb-5 flex flex-wrap gap-3">
      <button type="button" disabled={Boolean(running)} onClick={() => void start('dry-run')} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50">Verifică inventarul</button>
      <button type="button" disabled={Boolean(running)} onClick={() => void start('copy')} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">Copiază și verifică</button>
      <button type="button" disabled={!running} onClick={() => { cancelled.current = true }} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Oprește după lot</button>
    </div>
    <p role="status" className="mb-4 font-medium">{message}</p>
    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
      <dt>Loturi</dt><dd>{batches}</dd><dt>Examinate</dt><dd>{counts.examined}</dd>
      <dt>Existente</dt><dd>{counts.present}</dd><dt>Lipsă în R2</dt><dd>{counts.missing}</dd>
      <dt>Copiate</dt><dd>{counts.copied}</dd><dt>Verificate deja</dt><dd>{counts.verifiedExisting}</dd>
      <dt>Șterse anterior</dt><dd>{counts.deleted}</dd><dt>Octeți verificați</dt><dd>{counts.verifiedBytes}</dd>
    </dl>
  </main>
}
