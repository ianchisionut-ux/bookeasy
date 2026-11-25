'use client'

import { useRef, useState } from 'react'

type DryRunResult = { verified: number; verifiedBytes: number; proofs: string[]; hasMore: boolean; nextCursor: string | null; error?: string }
type PurgeResult = { purged: number; remaining: number; processedProof?: string; error?: string }

export default function PrivateBlobPurgeControls() {
  const [running, setRunning] = useState<'verify' | 'purge' | null>(null)
  const [proofs, setProofs] = useState<string[]>([])
  const [verified, setVerified] = useState(0)
  const [verifiedBytes, setVerifiedBytes] = useState(0)
  const [purged, setPurged] = useState(0)
  const [message, setMessage] = useState('Ștergerea sursei este dezactivată implicit și cere verificarea completă.')
  const cancelled = useRef(false)

  async function request(body: Record<string, unknown>) {
    const response = await fetch('/api/superadmin/storage-migration/purge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store',
    })
    const result = await response.json() as DryRunResult & PurgeResult
    if (!response.ok || result.error) throw new Error(result.error || `HTTP ${response.status}`)
    return result
  }

  async function verifyAll() {
    if (running) return
    cancelled.current = false
    setRunning('verify')
    setProofs([])
    setVerified(0)
    setVerifiedBytes(0)
    setPurged(0)
    setMessage('Verific fiecare sursă privată cu copia R2 și caut referințe vechi în baza de date…')
    let cursor: string | undefined
    let count = 0
    let bytes = 0
    const collected: string[] = []
    try {
      for (;;) {
        if (cancelled.current) { setMessage('Verificare oprită. Reîncepe pentru un inventar complet.'); break }
        const result = await request({ mode: 'dry-run', limit: 2, ...(cursor ? { cursor } : {}) })
        if (!Array.isArray(result.proofs) || result.proofs.length !== result.verified) throw new Error('invalid_inventory')
        count += result.verified
        bytes += result.verifiedBytes
        collected.push(...result.proofs)
        setVerified(count)
        setVerifiedBytes(bytes)
        if (!result.hasMore) {
          setProofs(collected)
          setMessage(`Inventar complet: ${count} fișiere și ${bytes.toLocaleString('ro-RO')} octeți verificați în R2. Nu a fost șters niciun fișier.`)
          break
        }
        if (!result.nextCursor || result.nextCursor === cursor) throw new Error('invalid_cursor')
        cursor = result.nextCursor
      }
    } catch (error) {
      setProofs([])
      setMessage(`Verificarea s-a oprit: ${error instanceof Error ? error.message : 'eroare necunoscută'}. Niciun fișier nu a fost șters.`)
    } finally { setRunning(null) }
  }

  async function purgeAll() {
    if (running || !proofs.length) return
    cancelled.current = false
    setRunning('purge')
    setMessage('Ștergere condiționată în curs. Fiecare fișier este reverificat înainte de ștergere…')
    let remainingProofs = [...proofs]
    let deleted = 0
    try {
      while (remainingProofs.length) {
        if (cancelled.current) { setMessage('Ștergerea s-a oprit după ultimul fișier verificat. Reia verificarea pentru restul.'); break }
        const result = await request({ mode: 'purge', proofs: remainingProofs })
        if (result.purged !== 1 || !result.processedProof || !remainingProofs.includes(result.processedProof) ||
          result.remaining !== remainingProofs.length - 1) throw new Error('inventory_changed')
        remainingProofs = remainingProofs.filter(proof => proof !== result.processedProof)
        deleted++
        setPurged(deleted)
        setProofs([...remainingProofs])
      }
      if (!remainingProofs.length) setMessage(`Depozitul privat vechi este gol. ${deleted} fișiere au fost eliminate după verificare.`)
    } catch (error) {
      setProofs([])
      setMessage(`Ștergerea s-a oprit: ${error instanceof Error ? error.message : 'eroare necunoscută'}. Reia inventarul înainte de orice altă ștergere.`)
    } finally { setRunning(null) }
  }

  return <section className="mx-auto max-w-3xl border-t border-slate-200 p-6 text-sm text-slate-800">
    <h2 className="mb-3 text-xl font-semibold">Curățarea depozitului Blob privat</h2>
    <p className="mb-4">Disponibilă numai după copierea completă în R2 și eliminarea tuturor adreselor Blob din baza de date. Verificarea nu șterge nimic. Butonul de ștergere funcționează numai când opțiunea separată de curățare este activată pe server.</p>
    <div className="mb-4 flex flex-wrap gap-3">
      <button type="button" disabled={Boolean(running)} onClick={() => void verifyAll()} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50">Verifică pentru curățare</button>
      <button type="button" disabled={Boolean(running) || !proofs.length} onClick={() => void purgeAll()} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50">Șterge sursele verificate</button>
      <button type="button" disabled={!running} onClick={() => { cancelled.current = true }} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Oprește după fișier</button>
    </div>
    <p role="status" className="mb-3 font-medium">{message}</p>
    <p>Verificate: {verified} · Octeți: {verifiedBytes.toLocaleString('ro-RO')} · Șterse în această sesiune: {purged}</p>
  </section>
}
