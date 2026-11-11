'use client'

import { useEffect, useRef, useState } from 'react'
import { clearNativeGoogleFlow } from '@/lib/native-google-client'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Trash2, X } from 'lucide-react'

export default function AccountDeletionCard({ kind, accountName }: { kind: 'customer' | 'business'; accountName: string }) {
  const business = kind === 'business'
  const dialog = useRef<HTMLDialogElement>(null)
  const confirmationInput = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [challenge, setChallenge] = useState<{ token: string; confirmation: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = business ? 'Șterge definitiv afacerea' : 'Șterge contul personal'

  useEffect(() => {
    if (step && !dialog.current?.open) dialog.current?.showModal()
    if (!step && dialog.current?.open) dialog.current.close()
    if (step === 2) confirmationInput.current?.focus()
  }, [step])
  function close() {
    if (busy) return
    setStep(0); setAcknowledged(false); setConfirmation(''); setChallenge(null); setError('')
  }
  async function proceed() {
    if (!acknowledged || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetchWithTimeout(`/api/${kind}/account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledged: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Confirmarea nu a putut fi pregătită.')
      setChallenge(data); setAcknowledged(false); setStep(2)
    } catch (error) { setError(error instanceof Error ? error.message : 'Conexiunea a fost întreruptă. Încearcă din nou.') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!challenge || !acknowledged || confirmation !== challenge.confirmation || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetchWithTimeout(`/api/${kind}/account`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledged: true, token: challenge.token, confirmation }) }, 65000)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Contul nu a putut fi șters.')
      clearNativeGoogleFlow()
      try { for (const key of Object.keys(localStorage)) if (key.startsWith('bookeasy')) localStorage.removeItem(key) } catch {}
      window.location.replace(`/cont?deleted=${kind}`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Verifică starea contului înainte de a reîncerca. Răspunsul serverului nu a ajuns.') }
    finally { setBusy(false) }
  }
  return <section id={business ? 'stergere-cont-afacere' : 'stergere-cont'} className="mt-6 border-t border-[var(--border-soft)] pt-5">
    <h2 className="text-sm font-semibold">Ștergerea contului</h2>
    <p className="mb-3 mt-1 text-sm text-gray-500">{business ? 'Închide definitiv afacerea și elimină accesul echipei. Vor urma două confirmări.' : 'Poți șterge singur contul personal, în doi pași, fără o cerere prin email.'}</p>
    <button type="button" onClick={() => setStep(1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 size={16}/>{label}</button>
    <dialog ref={dialog} aria-labelledby={`delete-title-${kind}`} onCancel={event => { event.preventDefault(); close() }} onClose={() => { if (!busy) setStep(0) }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-5 text-[var(--brand-ink)] shadow-xl backdrop:bg-black/40 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">Confirmare {step || 1} din 2</p><h2 id={`delete-title-${kind}`} className="text-xl font-semibold">{label}</h2></div><button type="button" aria-label="Închide confirmarea" disabled={busy} onClick={close} className="rounded-lg p-2 disabled:opacity-50"><X size={20}/></button></div>
      <p className="mt-3 break-words text-sm font-medium">{accountName}</p>
      {step === 1 ? <>
        {business ? <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600"><li>Se elimină pagina publică, programările, clienții, mesajele, setările și accesul tuturor membrilor echipei.</li><li>Fișierele încărcate sunt eliminate automat. Salvează înainte documentele de care ai nevoie.</li><li>Documentele contractuale și de facturare necesare evidențelor rămân într-o arhivă separată, protejată.</li><li>Conturile Google, Facebook și Instagram nu sunt șterse.</li></ul> : <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600"><li>Se șterg autentificarea BookEasy, profilul personal și recenziile BookEasy asociate.</li><li>Vei fi deconectat de pe toate dispozitivele. Contul tău Google nu este șters.</li><li>Programările existente nu se anulează. Evidențele gestionate de afaceri rămân la acestea.</li></ul>}
        <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy}/><span>Am citit și am înțeles ce se șterge.</span></label>
      </> : <>
        <p className="mt-4 text-sm text-gray-600">Acțiunea este definitivă și nu poate fi anulată. Pentru confirmarea finală, scrie exact <strong className="break-words">{challenge?.confirmation}</strong>.</p>
        <label className="mt-4 block text-sm font-medium" htmlFor={`delete-confirm-${kind}`}>{business ? 'Numele afacerii' : 'Text de confirmare'}</label>
        <input ref={confirmationInput} id={`delete-confirm-${kind}`} autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} className="input-field mt-1 w-full" />
        <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy}/><span>Confirm că doresc ștergerea definitivă.</span></label>
      </>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={close} disabled={busy} className="btn-secondary min-h-11 disabled:opacity-50">Renunță</button><button type="button" onClick={step === 1 ? proceed : remove} disabled={busy || !acknowledged || (step === 2 && (!challenge || confirmation !== challenge.confirmation))} className="min-h-11 rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40">{busy ? 'Se procesează...' : step === 1 ? 'Continuă la confirmarea finală' : 'Șterge definitiv'}</button></div>
    </dialog>
  </section>
}
