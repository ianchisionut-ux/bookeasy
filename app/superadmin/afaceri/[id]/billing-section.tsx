'use client'

import { DragEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input, Pill } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const LABEL: Record<string, string> = { GRATUIT: 'Gratuit (demo)', NEPLATIT: 'Neplătit', PLATIT: 'Plătit', RESTANT: 'Restant' }
const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { GRATUIT: 'neutral', NEPLATIT: 'warning', PLATIT: 'success', RESTANT: 'danger' }

type Props = {
  businessId: string; initialPlanName: string | null; initialStatus: string; initialNote: string | null
  initialAmount: number | null; initialSubtotal: number | null; initialVatRate: number
  initialDueAt: string | null; invoiceName: string | null; initialLegalName: string
  initialClientType: string; initialCif: string | null; initialRegCom: string | null
  initialAddress: string | null; initialCounty: string | null; initialCity: string | null
  initialPostalCode: string | null; initialEmail: string | null
}

export default function BillingSection(p: Props) {
  const router = useRouter(), inputRef = useRef<HTMLInputElement>(null)
  const [planName, setPlanName] = useState(p.initialPlanName ?? ''), [status, setStatus] = useState(p.initialStatus), [note, setNote] = useState(p.initialNote ?? '')
  const [subtotal, setSubtotal] = useState(p.initialSubtotal?.toString() ?? ''), [vatRate, setVatRate] = useState(String(p.initialVatRate)), [dueAt, setDueAt] = useState(p.initialDueAt?.slice(0, 10) ?? '')
  const [legalName, setLegalName] = useState(p.initialLegalName), [clientType, setClientType] = useState(p.initialClientType === 'PF' ? 'PF' : 'PJ')
  const [cif, setCif] = useState(p.initialCif ?? ''), [regCom, setRegCom] = useState(p.initialRegCom ?? ''), [address, setAddress] = useState(p.initialAddress ?? '')
  const [county, setCounty] = useState(p.initialCounty ?? ''), [city, setCity] = useState(p.initialCity ?? ''), [postalCode, setPostalCode] = useState(p.initialPostalCode ?? ''), [email, setEmail] = useState(p.initialEmail ?? '')
  const [file, setFile] = useState<File | null>(null), [invoiceName, setInvoiceName] = useState(p.invoiceName), [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('')
  const estimatedTotal = subtotal ? Number(subtotal) * (1 + Number(vatRate) / 100) : 0

  async function persistSettings() {
    const res = await fetchWithTimeout(`/api/superadmin/businesses/${p.businessId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      planName: planName || null, billingStatus: status, billingNote: note || null,
      billingSubtotal: subtotal ? Number(subtotal) : null, billingVatRate: Number(vatRate),
      billingDueAt: dueAt ? new Date(`${dueAt}T12:00:00Z`).toISOString() : null,
      billingLegalName: legalName || null, billingClientType: clientType, billingCif: cif || null,
      billingRegCom: regCom || null, billingAddress: address || null, billingCounty: county || null,
      billingCity: city || null, billingPostalCode: postalCode || null, billingEmail: email || null,
    }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Datele nu au putut fi salvate.')
  }

  async function save() {
    setSaving(true); setMessage('')
    try {
      await persistSettings()
      if (file) {
        const form = new FormData(); form.set('file', file)
        const upload = await fetchWithTimeout(`/api/superadmin/businesses/${p.businessId}/invoice`, { method: 'POST', body: form }, 30_000)
        const data = await upload.json().catch(() => ({}))
        if (!upload.ok) throw new Error(data.error || 'Upload eșuat.')
        setInvoiceName(file.name); setFile(null)
      }
      setMessage('Datele de facturare au fost salvate.'); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Salvarea a eșuat.') }
    finally { setSaving(false) }
  }

  async function generateInvoice() {
    setSaving(true); setMessage('')
    try {
      await persistSettings()
      const response = await fetchWithTimeout(`/api/superadmin/businesses/${p.businessId}/invoice/generate`, { method: 'POST' }, 30_000)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Factura nu a putut fi emisă.')
      setInvoiceName(`${String(data.reference).replace(/\s+/g, '_')}.pdf`)
      setMessage(`Factura ${data.reference} a fost emisă în Signal: ${Number(data.total).toFixed(2)} RON.`); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Factura nu a putut fi emisă.') }
    finally { setSaving(false) }
  }

  async function removeInvoice() {
    if (!confirm('Elimini factura încărcată din Bookeasy? O factură fiscală emisă în Signal nu poate fi ștearsă.')) return
    setSaving(true); setMessage('')
    try {
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${p.businessId}/invoice`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || 'Ștergerea a eșuat.')
      setInvoiceName(null); setMessage('Factura încărcată a fost eliminată.'); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Ștergerea a eșuat.') }
    finally { setSaving(false) }
  }

  function dropped(event: DragEvent) { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) setFile(event.dataTransfer.files[0]) }

  return <Card>
    <div className="flex items-center justify-between mb-1"><h2 className="font-medium">Abonament și factură</h2><Pill tone={TONE[status]}>{LABEL[status]}</Pill></div>
    <p className="text-sm text-gray-500 mb-4">Factura este emisă de Next Level în Signal și devine disponibilă clientului în Bookeasy.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <div><label className="text-sm text-gray-500 block mb-1.5">Plan</label><Input placeholder="ex: Standard" value={planName} onChange={(e) => setPlanName(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Status plată</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field w-full">{Object.entries(LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Valoare fără TVA (RON)</label><Input type="number" min="0.01" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">TVA</label><select value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="input-field w-full">{[21, 19, 11, 9, 5, 0].map((value) => <option key={value} value={value}>{value}%</option>)}</select></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Scadență</label><Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Total estimat</label><Input value={`${estimatedTotal.toFixed(2)} RON`} disabled /></div>
    </div>
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Date client</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <div className="sm:col-span-2"><label className="text-sm text-gray-500 block mb-1.5">Denumire / nume</label><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Tip client</label><select value={clientType} onChange={(e) => setClientType(e.target.value)} className="input-field w-full"><option value="PJ">Persoană juridică</option><option value="PF">Persoană fizică</option></select></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">{clientType === 'PJ' ? 'CIF' : 'CNP (opțional)'}</label><Input value={cif} onChange={(e) => setCif(e.target.value)} /></div>
      {clientType === 'PJ' && <div><label className="text-sm text-gray-500 block mb-1.5">Nr. Registrul Comerțului</label><Input value={regCom} onChange={(e) => setRegCom(e.target.value)} /></div>}
      <div><label className="text-sm text-gray-500 block mb-1.5">E-mail facturare</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="sm:col-span-2"><label className="text-sm text-gray-500 block mb-1.5">Adresă</label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Județ</label><Input value={county} onChange={(e) => setCounty(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Localitate</label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
      <div><label className="text-sm text-gray-500 block mb-1.5">Cod poștal</label><Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></div>
    </div>
    <label className="text-sm text-gray-500 block mb-1.5">Notă internă (opțional)</label><Input placeholder="ex: abonament septembrie" value={note} onChange={(e) => setNote(e.target.value)} className="mb-3" />
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={save} disabled={saving}>{saving ? 'Se procesează...' : 'Salvează datele'}</Button>
      <Button onClick={generateInvoice} disabled={saving || Boolean(invoiceName)}>{invoiceName ? 'Factură deja emisă' : 'Emite factura în Signal'}</Button>
      {invoiceName && <a href={`/api/billing/invoice/${p.businessId}`} className="text-sm text-[var(--accent)] hover:underline">Descarcă {invoiceName}</a>}
    </div>
    <details className="mt-4 rounded-xl border border-gray-200 p-3">
      <summary className="cursor-pointer text-xs text-gray-500">Încărcare manuală de rezervă</summary>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={dropped} className={`mt-3 w-full rounded-xl border-2 border-dashed p-4 text-center text-sm ${dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-gray-200 bg-gray-50'}`}>{file ? file.name : 'Alege un PDF, JPG sau PNG'}</button>
      {invoiceName && <button type="button" onClick={removeInvoice} disabled={saving} className="mt-2 text-xs text-red-600">Elimină numai factura încărcată manual</button>}
    </details>
    {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
  </Card>
}
