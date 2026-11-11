'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { publicSlugFromName } from '@/lib/public-slug'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { businessSetupHref } from '@/lib/business-preview'
import { bookingTerminology, PUBLIC_CATEGORIES } from '@/lib/business-categories'

function CopyableLink({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <a href={path} target="_blank" rel="noopener noreferrer" className="input-field flex-1 truncate text-[var(--accent)]">
          bookeasy.ro{path}
        </a>
        <button onClick={copy} className="btn-secondary text-sm whitespace-nowrap">
          {copied ? 'Copiat!' : 'Copiază'}
        </button>
      </div>
    </div>
  )
}

export function PublicPageLinkCard({ slug, businessName, canEdit, category, isClinic, publicListed, accountActive, onboardingDone, onboardingStep, activeServiceCount }: { slug: string; businessName: string; canEdit: boolean; category: string; isClinic: boolean; publicListed: boolean; accountActive: boolean; onboardingDone: boolean; onboardingStep: number; activeServiceCount: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(slug)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true); setError('')
    try {
      const response = await fetchWithTimeout('/api/business/public-slug', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: draft }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Linkul nu a putut fi salvat.'); return }
      setDraft(data.slug); setEditing(false); router.refresh()
    } catch { setError('Conexiunea a eșuat. Încearcă din nou.') } finally { setSaving(false) }
  }
  const available = publicListed && accountActive
  const booking = bookingTerminology(category)
  const canBookOnline = PUBLIC_CATEGORIES.some(item => item === category)
  return (
    <Card className="mb-5 break-inside-avoid">
      <h2 className="font-medium mb-1">Pagina ta publică</h2>
      {available ? <><p className="text-sm text-gray-500 mb-3">
        Link-urile pe care le trimiți {isClinic ? 'pacienților' : 'clienților'} sau le pui pe rețele sociale.
      </p>
      <div className="flex flex-col gap-3">
        <CopyableLink path={`/${slug}`} label="Profil public" />
        {canBookOnline && <CopyableLink path={`/${slug}/rezerva`} label={`${booking.heading} online`} />}
      </div>
      {canBookOnline && activeServiceCount === 0 && <p className="mt-3 text-sm text-amber-800">Adaugă oferte active pentru a primi {booking.plural}.</p>}
      {canEdit && <div className="mt-4 border-t border-[var(--border-soft)] pt-3">
        {editing ? <div className="space-y-3">
          <label htmlFor="public-link-name" className="block text-xs text-gray-600">Adresa paginii tale</label>
          <div className="flex items-center gap-1 text-sm"><span>bookeasy.ro/</span><input id="public-link-name" className="input-field min-w-0 flex-1" value={draft} onChange={event => setDraft(event.target.value.toLowerCase())} maxLength={64} /></div>
          <button type="button" className="text-xs text-[var(--accent-hover)] underline" onClick={() => setDraft(publicSlugFromName(businessName))}>Folosește numele afacerii</button>
          <p className="text-xs text-gray-500">Linkurile vechi vor redirecționa automat către adresa nouă.</p>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2"><button type="button" disabled={saving} onClick={save} className="btn-primary text-sm">{saving ? 'Se salvează...' : 'Salvează linkul'}</button><button type="button" disabled={saving} onClick={() => setEditing(false)} className="btn-secondary text-sm">Renunță</button></div>
        </div> : <button type="button" onClick={() => { setDraft(slug); setEditing(true) }} className="text-sm text-[var(--accent-hover)] underline">Personalizează linkul</button>}
      </div>}
      </> : <div className="space-y-3">
        <p className="text-sm text-gray-500">{!accountActive ? 'Contul este suspendat. Contactează BookEasy pentru reactivare.' : onboardingDone ? 'Pagina este ascunsă. Activează vizibilitatea publică și salvează setările înainte să distribui linkurile.' : 'Pagina nu este publicată încă. Finalizează configurarea înainte să trimiți linkurile clienților.'}</p>
        <div className="flex flex-wrap gap-2"><a className="btn-secondary text-sm" href={`/${slug}`} target="_blank" rel="noopener noreferrer">Previzualizează profilul</a>{canBookOnline && <a className="btn-secondary text-sm" href={`/${slug}/rezerva`} target="_blank" rel="noopener noreferrer">Previzualizează {booking.plural}</a>}</div>
        {accountActive && <a className="btn-primary inline-flex text-sm" href={businessSetupHref(onboardingDone, onboardingStep)}>{onboardingDone ? 'Setări de vizibilitate' : 'Continuă configurarea'}</a>}
      </div>}
    </Card>
  )
}
