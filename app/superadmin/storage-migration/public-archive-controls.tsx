'use client'

import { useState } from 'react'

type Result = { databaseReferences: number; sourceBytes: number; sourceSha256: string;
  r2Present: boolean; r2Verified: boolean; copyNeeded: boolean; error?: string }

export default function PublicArchiveControls() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [message, setMessage] = useState('Un fișier vechi din depozitul Blob public este tratat separat de cele private.')

  async function run(mode: 'dry-run' | 'copy') {
    if (running) return
    setRunning(true)
    setMessage(mode === 'copy' ? 'Copiere și verificare SHA-256 în curs…' : 'Verificare în curs…')
    try {
      const response = await fetch('/api/superadmin/storage-migration/public-archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }), cache: 'no-store',
      })
      const value = await response.json() as Result
      if (!response.ok || value.error) throw new Error(value.error || `HTTP ${response.status}`)
      setResult(value)
      setMessage(value.r2Verified
        ? 'Fișierul public este copiat și identic în R2. Sursa Vercel rămâne neatinsă.'
        : 'Fișierul public nu este încă în R2. Poți porni copierea verificată.')
    } catch (error) {
      setResult(null)
      setMessage(`Verificarea s-a oprit: ${error instanceof Error ? error.message : 'eroare necunoscută'}.`)
    } finally { setRunning(false) }
  }

  return <section className="mx-auto max-w-3xl border-t border-slate-200 p-6 text-sm text-slate-800">
    <h2 className="mb-3 text-xl font-semibold">Arhiva din depozitul public</h2>
    <p className="mb-4">Verifică și păstrează separat vechea imagine publică. Aceste acțiuni nu o șterg din Vercel.</p>
    <div className="mb-4 flex flex-wrap gap-3">
      <button type="button" disabled={running} onClick={() => void run('dry-run')} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50">Verifică arhiva</button>
      <button type="button" disabled={running || result?.r2Verified} onClick={() => void run('copy')} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">Copiază și verifică în R2</button>
    </div>
    <p role="status" className="mb-3 font-medium">{message}</p>
    {result && <p>Referințe în baza de date: {result.databaseReferences} · Dimensiune: {result.sourceBytes.toLocaleString('ro-RO')} octeți · Copie R2: {result.r2Verified ? 'verificată SHA-256' : 'absentă'}</p>}
  </section>
}
