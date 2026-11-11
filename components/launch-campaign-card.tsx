'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Gift, Check, RefreshCw } from 'lucide-react'
import { LAUNCH_STAGE_LABEL } from '@/lib/launch-policy'
import type { getLaunchDetails } from '@/lib/launch-campaign'

type Details = NonNullable<Awaited<ReturnType<typeof getLaunchDetails>>>
const date = (value: string) => new Date(value).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })

export function LaunchCampaignSummary({ open, enrolled, configuring }: { open: boolean; enrolled: number; configuring: number }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const router = useRouter()
  async function toggle() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/superadmin/launch-campaign', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrollmentOpen: !open }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Setarea nu a putut fi salvată.')
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Conexiune întreruptă.') }
    finally { setBusy(false) }
  }
  return <section className="mb-6 rounded-2xl border border-emerald-100 bg-gradient-to-r from-[var(--accent-soft)] to-[var(--brand-green-soft)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Gift size={19} />Cod promoțional Lansare2 <span className="rounded-full bg-white px-2 py-1 text-[10px]">{open ? 'Înscrieri deschise' : 'Înscrieri închise'}</span></h2><p className="mt-2 text-sm">2 luni gratuite <ArrowRight size={13} className="inline mx-1" />55 lei/lună din luna 3</p><p className="mt-2 text-xs text-gray-600">{enrolled} afaceri înscrise · {configuring} în configurare. Gratuitatea se acordă numai cu codul Lansare2, de la finalizarea configurării. Fără cod: abonament Standard.</p></div><button type="button" disabled={busy} className="btn-secondary text-xs" onClick={() => void toggle()}>{busy ? 'Se salvează…' : open ? 'Oprește înscrierile noi' : 'Redeschide înscrierile'}</button></div><p className="mt-3 text-xs text-gray-500">Închiderea înscrierilor păstrează oferta pentru toate afacerile deja înscrise.</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>
}

export function LaunchBusinessCard({ details, businessId, admin = false }: { details: Details; businessId: string; admin?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const router = useRouter()
  async function action(body: { action: 'pay'; periodId: string } | { action: 'manual' | 'refresh' }) {
    if (body.action === 'manual' && !window.confirm('Oprești automatizarea campaniei pentru această afacere și continui cu facturare manuală? Perioadele și plățile existente se păstrează.')) return
    if (body.action === 'pay' && !window.confirm('Confirmi că ai încasat integral suma pentru această perioadă?')) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/superadmin/businesses/${encodeURIComponent(businessId)}/launch-campaign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Operațiunea nu a reușit.')
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Conexiune întreruptă.') }
    finally { setBusy(false) }
  }
  return <section className="card mb-5 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Gift size={18} className="text-[var(--accent-hover)]" />Planul actual</h2><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-hover)]">{LAUNCH_STAGE_LABEL[details.stage]}</span></div>
    <p className="mt-3 text-sm font-medium">{details.stage === 'FREE' || details.stage === 'ONBOARDING' ? 'Gratuit · 0 lei' : `${details.billingAmount ?? details.currentMinor / 100} lei`}</p>
    {details.freeUntilNotice && <p className="mt-2 text-xs text-gray-500">Activare și utilizare gratuite, fără termen stabilit. Orice ofertă plătită viitoare va necesita notificare prealabilă și acordul tău explicit.</p>}
    {!details.freeUntilNotice && details.stage === 'ONBOARDING' && <p className="mt-2 text-xs text-gray-500">{details.freeMonths} {details.freeMonths === 1 ? 'lună gratuită' : 'luni gratuite'} de la finalizarea configurării.</p>}
    {details.stage === 'FREE' && details.freeEndsAt && <p className="mt-2 text-sm text-gray-600">Gratuit până la <strong>{date(details.freeEndsAt)}</strong>.</p>}
    {details.stage !== 'FREE' && details.stage !== 'ONBOARDING' && details.dueAt && <p className="mt-2 text-sm text-gray-600">Scadență: <strong>{date(details.dueAt)}</strong>.</p>}
    {admin && details.periods.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold">Istoricul perioadelor și plăților</summary><div className="mt-3 space-y-2">{details.periods.map(period => <div key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] px-3 py-3 text-xs"><div><strong>{date(period.startsAt)} – {date(period.endsAt)}</strong><p className="mt-1 text-gray-500">{period.amount === 0 ? 'Gratuit' : `${period.amount} RON · ${period.paidAt ? 'Achitat' : 'Neachitat'}`}</p></div><div className="flex items-center gap-2">{period.hasInvoice && <a className="text-[var(--accent-hover)] underline" href={`/api/billing/invoice/${businessId}?periodId=${period.id}`}>Factură</a>}{details.managed && period.amount > 0 && !period.paidAt && <button type="button" disabled={busy} className="btn-secondary text-xs" onClick={() => void action({ action: 'pay', periodId: period.id })}><Check size={13} className="inline mr-1" />Marchează achitat</button>}</div></div>)}</div></details>}
    {admin && details.managed && <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} type="button" className="text-xs font-semibold text-[var(--accent-hover)]" onClick={() => void action({ action: 'refresh' })}><RefreshCw size={13} className="inline mr-1" />Actualizează perioadele</button><button disabled={busy} type="button" className="text-xs text-gray-500 underline" onClick={() => void action({ action: 'manual' })}>Treci la facturare manuală</button></div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>
}
