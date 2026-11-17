'use client'

import {formatPlanPrice,type PlanPrices} from '@/lib/plan-pricing-display'
import { useEffect, useState } from 'react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Invite = {
  id: string
  email: string
  name: string
  offeredPlan: 'FREE' | 'STANDARD' | 'PRO' | 'CAMPAIGN'
  promoCode: string | null
  headerImageUrl: string | null
  expiresAt: string
  sentAt: string | null
  acceptedAt: string | null
  revokedAt: string | null
  lastError: string | null
}
type Promotion = { code: string; name: string; freeMonths: number; freeUntilNotice: boolean }
type Action = { action: 'invite'; email: string; name: string; offeredPlan: Invite['offeredPlan']; promoCode?: string; headerImageUrl?: string } | { action: 'resend' | 'revoke' | 'delete' | 'restore'; id: string }
const defaultHeader = '/email/bookeasy-invitation-header-wide.jpg'

export default function InvitationManager() {
  const [items, setItems] = useState<Invite[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [prices,setPrices]=useState<PlanPrices|null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [offeredPlan, setOfferedPlan] = useState<Invite['offeredPlan']>('STANDARD')
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    const response = await fetchWithTimeout('/api/superadmin/invitations')
    const data = await response.json()
    if (!response.ok) throw Error(data.error)
    setItems(data.invitations)
    setPromotions(data.promotions)
    setPrices(data.prices)
    setLoaded(true)
  }

  useEffect(() => { void load().catch(() => setError('Invitațiile nu pot fi încărcate.')) }, [])

  async function uploadHeader(file: File) {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.set('image', file)
      const response = await fetchWithTimeout('/api/superadmin/invitations/header', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw Error(data.error)
      setHeaderImageUrl(data.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Imaginea nu a putut fi încărcată.')
    } finally {
      setUploading(false)
    }
  }

  async function act(body: Action) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetchWithTimeout('/api/superadmin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      await load()
      if (!response.ok) throw Error(data.error)
      if (body.action === 'delete') setDeletedId(body.id)
      if (body.action === 'restore') setDeletedId(null)
      setNotice(body.action === 'delete' ? 'Invitația a fost eliminată, iar linkul invalidat. Contul afacerii rămâne neschimbat.' : body.action === 'restore' ? 'Invitația a fost restaurată. Retrimite-o pentru un link nou.' : body.action === 'revoke'
        ? 'Linkul invitației a fost revocat.'
        : body.action === 'invite' && body.offeredPlan === 'CAMPAIGN' && body.promoCode
          ? `Invitația cu codul ${body.promoCode} a fost trimisă. Oferta se aplică după acceptarea condițiilor de către destinatar.`
          : body.action === 'invite' ? `Invitația pentru planul ${body.offeredPlan} a fost trimisă prin email.` : 'Invitația a fost retrimisă prin email.')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conexiune întreruptă.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-6">
    <form className="card grid gap-4 p-5 sm:grid-cols-2" onSubmit={async event => {
      event.preventDefault()
      if (await act({ action: 'invite', email, name, offeredPlan, promoCode: offeredPlan === 'CAMPAIGN' ? promoCode || undefined : undefined, headerImageUrl: headerImageUrl || undefined })) {
        setEmail('')
        setName('')
        setPromoCode('')
        setOfferedPlan('STANDARD')
        setHeaderImageUrl('')
      }
    }}>
      <label className="text-sm">Emailul proprietarului
        <input type="email" required autoComplete="email" className="input-field mt-1 w-full" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      </label>
      <label className="text-sm">Numele afacerii (opțional)
        <input className="input-field mt-1 w-full" maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} />
      </label>
      <label className="text-sm">Planul oferit prin invitație
        <select className="input-field mt-1 w-full" value={offeredPlan} onChange={event => { setOfferedPlan(event.target.value as Invite['offeredPlan']); setPromoCode('') }} disabled={busy}>
          <option value="FREE">FREE · fără abonament</option>
          <option value="STANDARD">STANDARD · {prices?formatPlanPrice(prices.standardMinor):'Se încarcă...'}</option>
          <option value="PRO">PRO · {prices?formatPlanPrice(prices.proMinor):'Se încarcă...'}</option>
          <option value="CAMPAIGN">CAMPANIE · acces PRO</option>
        </select>
      </label>
      {offeredPlan === 'CAMPAIGN' && <label className="text-sm">Codul campaniei
        <select className="input-field mt-1 w-full" value={promoCode} onChange={event => setPromoCode(event.target.value)} disabled={busy}>
          <option value="">Fără cod promoțional</option>
          {promotions.map(promotion => <option key={promotion.code} value={promotion.code}>{promotion.code} · {promotion.name} · {promotion.freeUntilNotice ? 'Gratuit, fără termen stabilit' : `${promotion.freeMonths} luni gratuite`}</option>)}
        </select>
      </label>}
      <div className="sm:col-span-2 grid gap-4 rounded-2xl border border-teal-100 bg-teal-50/40 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,380px)]">
        <div>
          <h2 className="font-semibold text-slate-800">Antetul invitației</h2>
          <p className="mt-1 text-sm text-slate-600">Antetul general BookEasy include logo-ul oficial și o prezentare a calendarului, mesajelor și statisticilor. Poți folosi și o imagine proprie pentru afacerea invitată.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary text-sm" disabled={busy || uploading || !headerImageUrl} onClick={() => setHeaderImageUrl('')}>Folosește antetul BookEasy</button>
            <label className="btn-secondary cursor-pointer text-sm">{uploading ? 'Se încarcă...' : 'Încarcă alt antet'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy || uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadHeader(file); event.target.value = '' }} />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">JPG, PNG sau WebP · maximum 3 MB · minimum 600 × 200 px. Antetul ales rămâne și la retrimitere.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headerImageUrl || defaultHeader} alt="Previzualizare antet invitație BookEasy" className="w-full rounded-xl border border-teal-100 bg-white object-contain" />
      </div>
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-800">Ce va primi afacerea în email</h2>
        <p className="mt-2">O prezentare a profilului public, rezervărilor online, calendarului, clienților, conversațiilor și statisticilor, apoi oferta pentru planul ales și butonul „Vreau să îmi înscriu afacerea”.</p>
        <p className="mt-1 text-xs text-slate-500">Funcțiile sunt explicate cu condițiile planului și ale integrărilor. Linkul de înscriere rămâne valabil 24 de ore.</p>
      </div>
      <div className="flex items-end sm:col-span-2"><button type="submit" className="btn-primary w-full" disabled={busy || uploading}>{busy ? 'Se procesează...' : 'Trimite invitația cu prezentarea BookEasy'}</button></div>
      <p className="text-xs text-gray-500 sm:col-span-2">Planul ales apare în invitație. Pentru campanie, codul se completează automat, iar destinatarul acceptă condițiile ofertei înainte de activare.</p>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-700">{notice} {deletedId && <button type="button" disabled={busy} className="ml-2 underline" onClick={()=>void act({action:'restore',id:deletedId})}>Anulează ștergerea</button>}</p>}
    <div className="grid gap-4 lg:grid-cols-2">{items.map(invite => <article key={invite.id} className="card p-5">
      <h2 className="font-semibold">{invite.name || invite.email}</h2>
      <p className="text-sm text-gray-500">{invite.email}</p>
      <p className="mt-2 text-sm font-medium text-teal-700">Plan oferit: {invite.offeredPlan}{invite.promoCode ? ` · cod ${invite.promoCode}` : ''}</p>
      <p className="mt-1 text-xs text-gray-500">Antet: {invite.headerImageUrl ? 'personalizat' : 'BookEasy'}</p>
      <p className="mt-2 text-sm">{invite.acceptedAt ? 'Înrolare acceptată' : invite.revokedAt ? 'Invitație revocată' : new Date(invite.expiresAt) < new Date() ? 'Invitație expirată' : invite.sentAt ? 'Invitație trimisă' : 'Trimitere neconfirmată'}</p>
      <p className="mt-1 text-xs text-gray-500">Valabilă până la {new Date(invite.expiresAt).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}</p>
      {invite.lastError && <p className="mt-2 text-sm text-red-700">{invite.lastError}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="text-sm text-red-700 underline" type="button" disabled={busy} onClick={() => {if(window.confirm('Ștergi invitația pentru '+invite.email+'? Linkul va fi invalidat. Un cont deja creat nu va fi șters.'))void act({action:'delete',id:invite.id})}}>Șterge invitația</button>
        <button className="btn-secondary text-sm" type="button" disabled={busy} onClick={() => void act({ action: 'resend', id: invite.id })}>Retrimite invitația</button>
        {!invite.acceptedAt && !invite.revokedAt && <button className="text-sm text-red-700 underline" type="button" disabled={busy} onClick={() => void act({ action: 'revoke', id: invite.id })}>Revocă linkul</button>}
      </div>
    </article>)}</div>
    {!loaded && !error && <p className="text-sm text-gray-500">Se încarcă invitațiile...</p>}
    {loaded && !items.length && <p className="text-sm text-gray-500">Nu ai trimis încă invitații.</p>}
  </div>
}
