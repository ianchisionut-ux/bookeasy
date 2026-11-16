'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { publicSlugFromName } from '@/lib/public-slug'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { bookingTerminology, PUBLIC_CATEGORIES } from '@/lib/business-categories'

export function PublicPageLinkCard({ slug, businessName, canEdit, category, isClinic, accountActive, activeServiceCount }: {
  slug: string; businessName: string; canEdit: boolean; category: string; isClinic: boolean; accountActive: boolean; activeServiceCount: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(slug)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const booking = bookingTerminology(category)
  const available = accountActive && PUBLIC_CATEGORIES.some(item => item === category)
  const path = `/${slug}/rezerva`

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setError('Nu am putut copia linkul. Selectează-l și copiază-l manual.') }
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const response = await fetchWithTimeout('/api/business/public-slug', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: draft }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Linkul nu a putut fi salvat.'); return }
      setDraft(data.slug); setEditing(false); router.refresh()
    } catch { setError('Conexiunea a eșuat. Încearcă din nou.') } finally { setSaving(false) }
  }

  return <Card className="mb-5 break-inside-avoid">
    <h2 className="mb-1 font-medium">Link direct de programare</h2>
    <p className="mb-3 text-sm text-gray-500">Trimite linkul {isClinic ? 'pacienților' : 'clienților'} tăi. Pagina se deschide fără cont; afacerea nu apare într-un marketplace.</p>
    {available ? <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <a href={path} target="_blank" rel="noopener noreferrer" className="input-field min-w-0 flex-1 truncate text-[var(--accent)]">bookeasy.ro{path}</a>
        <button type="button" onClick={copy} className="btn-secondary text-sm">{copied ? 'Copiat!' : 'Copiază'}</button>
      </div>
      {activeServiceCount === 0 && <p className="mt-3 text-sm text-amber-800">Adaugă servicii active pentru a primi {booking.plural}.</p>}
      {canEdit && <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
        {editing ? <div className="space-y-3">
          <label htmlFor="booking-link-name" className="block text-xs text-gray-600">Adresa linkului</label>
          <div className="flex items-center gap-1 text-sm"><span>bookeasy.ro/</span><input id="booking-link-name" className="input-field min-w-0 flex-1" value={draft} onChange={event => setDraft(event.target.value.toLowerCase())} maxLength={64} /><span>/rezerva</span></div>
          <button type="button" className="text-xs text-[var(--accent-hover)] underline" onClick={() => setDraft(publicSlugFromName(businessName))}>Folosește numele afacerii</button>
          <p className="text-xs text-gray-500">Linkurile vechi vor redirecționa către noua adresă.</p>
          <div className="flex gap-2"><button type="button" disabled={saving} onClick={save} className="btn-primary text-sm">{saving ? 'Se salvează...' : 'Salvează linkul'}</button><button type="button" disabled={saving} onClick={() => setEditing(false)} className="btn-secondary text-sm">Renunță</button></div>
        </div> : <button type="button" onClick={() => { setDraft(slug); setEditing(true) }} className="text-sm text-[var(--accent-hover)] underline">Personalizează linkul</button>}
      </div>}
    </> : <p className="text-sm text-gray-500">{accountActive ? 'Această categorie nu folosește rezervări online.' : 'Contul este suspendat. Linkul va funcționa după reactivare.'}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
  </Card>
}
