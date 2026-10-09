'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type LegalDetails = {
  billingClientType: string
  billingLegalName: string
  billingCif: string
  billingRegCom: string
  billingAddress: string
  billingCounty: string
  billingCity: string
  billingPostalCode: string
  billingEmail: string
  contractRepresentativeName: string
  contractRepresentativeRole: string
}

export function LegalDetailsForm({ initial, canEdit }: { initial: LegalDetails; canEdit: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const field = (key: keyof LegalDetails, label: string, className = '') => <label className={`block text-sm ${className}`}>{label}
    <input className="input-field mt-1 w-full" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} disabled={!canEdit || saving} maxLength={key === 'billingAddress' ? 500 : 200} />
  </label>

  async function save() {
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/business/legal-details', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Salvarea a eșuat.')
      setMessage('Datele juridice au fost salvate. Verifică documentele actualizate înainte de semnare.')
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Salvarea a eșuat.') }
    finally { setSaving(false) }
  }

  return <section className="card mb-5 break-inside-avoid p-5">
    <h2 className="font-medium">Date pentru contracte</h2>
    <p className="mb-4 mt-1 text-sm text-gray-500">Aceste date completează automat contractul de servicii și acordul GDPR. Verifică-le înainte de semnare.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">Tip beneficiar
        <select className="input-field mt-1 w-full" value={form.billingClientType} onChange={(event) => setForm({ ...form, billingClientType: event.target.value })} disabled={!canEdit || saving}><option value="PJ">Persoană juridică</option><option value="PF">Persoană fizică</option></select>
      </label>
      {field('billingLegalName', 'Denumire legală / nume')}
      {field('billingCif', form.billingClientType === 'PJ' ? 'CUI / CIF' : 'Identificator fiscal, opțional')}
      {form.billingClientType === 'PJ' && field('billingRegCom', 'Registrul Comerțului')}
      {field('billingAddress', 'Adresă legală', 'sm:col-span-2')}
      {field('billingCity', 'Localitate')}
      {field('billingCounty', 'Județ')}
      {field('billingPostalCode', 'Cod poștal')}
      {field('billingEmail', 'E-mail contractual')}
      {field('contractRepresentativeName', 'Numele reprezentantului')}
      {field('contractRepresentativeRole', 'Funcția reprezentantului')}
    </div>
    {canEdit ? <button type="button" onClick={save} disabled={saving} className="btn-primary mt-4 px-4 py-2 text-sm">{saving ? 'Se salvează...' : 'Salvează datele juridice'}</button> : <p className="mt-4 text-sm text-blue-700">Modifică datele din Super Admin sau autentifică-te drept titularul businessului.</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>
}
