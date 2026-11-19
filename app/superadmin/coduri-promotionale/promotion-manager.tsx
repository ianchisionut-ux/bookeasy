'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { QRCodeSVG } from 'qrcode.react'

type Campaign = {
  id: string
  code: string
  name: string
  freeMonths: number
  freeUntilNotice: boolean
  regularMinor: number
  enrollmentOpen: boolean
  startsAt: string | null
  endsAt: string | null
  deletedAt: string | null
  enrollments: number
}
type FunnelRow = { promoCode: string; utmCampaign: string; step: 'view' | 'start' | 'submit' | 'created'; count: number }
type CampaignTarget = { id: string; archived: boolean }

const blank = {
  name: '', code: '', freeMonths: 2, freeUntilNotice: true, regularMinor: 5500,
  enrollmentOpen: true, startsAt: '', endsAt: '',
}

function localDate(iso: string | null) {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function PromotionManager() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({ ...blank })
  const [editing, setEditing] = useState<CampaignTarget | null>(null)
  const [conflict, setConflict] = useState<CampaignTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [funnel, setFunnel] = useState<FunnelRow[]>([])
  const defaultMinor = useRef(5500)
  const restoring = editing?.archived === true
  const currentCampaigns = campaigns.filter(campaign => !campaign.deletedAt)
  const archivedCampaigns = campaigns.filter(campaign => campaign.deletedAt)

  const refresh = useCallback(async () => {
    const response = await fetchWithTimeout('/api/superadmin/promotions')
    const data = await response.json()
    if (!response.ok) throw Error(data.error || 'Campaniile nu pot fi încărcate.')
    setCampaigns(data.campaigns)
    if (data.prices) defaultMinor.current = data.prices.standardMinor
    setFunnel(data.funnel ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    let active = true
    void refresh().then(() => {
      if (active) setForm(current => ({ ...current, regularMinor: defaultMinor.current }))
    }).catch(error => {
      if (active) setError(error.message)
    })
    return () => { active = false }
  }, [refresh])

  function startEditing(target: CampaignTarget, campaign?: Campaign) {
    setEditing(target)
    if (campaign) {
      setForm({ ...campaign, startsAt: localDate(campaign.startsAt), endsAt: localDate(campaign.endsAt) })
    }
    setError('')
    setNotice('')
    setConflict(null)
    document.getElementById('promotion-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetForm() {
    setEditing(null)
    setForm({ ...blank, regularMinor: defaultMinor.current })
    setConflict(null)
    setError('')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    setConflict(null)
    try {
      const body = {
        ...(editing ? { id: editing.id, restore: restoring } : {}),
        code: form.code,
        freeMonths: form.freeMonths,
        freeUntilNotice: form.freeUntilNotice,
        regularMinor: form.regularMinor,
        name: form.name,
        enrollmentOpen: form.enrollmentOpen,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }
      const response = await fetchWithTimeout('/api/superadmin/promotions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        if (!editing && data.conflict?.archived) setConflict(data.conflict)
        throw Error(data.error || 'Campania nu a putut fi salvată.')
      }
      resetForm()
      setNotice(restoring ? 'Campania a fost restaurată cu același cod.' : 'Campania a fost salvată.')
      await refresh()
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Conexiune întreruptă. Reîncearcă.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(campaign: Campaign, permanent = false) {
    const message = permanent
      ? `Ștergi definitiv campania ${campaign.code}? Campania dispare din arhivă și nu mai poate fi restaurată. Ofertele deja acordate se păstrează. Dacă refolosești codul, linkurile și codurile QR existente vor deschide oferta nouă.`
      : `Arhivezi campania ${campaign.code}? Codul nu va mai accepta înscrieri noi până când îl restaurezi. Ofertele deja acordate se păstrează.`
    if (!window.confirm(message)) return
    setBusy(true)
    setError('')
    setNotice('')
    setConflict(null)
    try {
      const response = await fetchWithTimeout('/api/superadmin/promotions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, permanent }),
      })
      const data = await response.json()
      if (!response.ok) throw Error(data.error)
      if (editing?.id === campaign.id) resetForm()
      await refresh()
      router.refresh()
      setNotice(permanent ? `Campania a fost ștearsă definitiv. Poți refolosi codul ${campaign.code}.` : 'Campania a fost mutată în arhivă. O poți restaura oricând.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operațiunea nu a reușit.')
    } finally {
      setBusy(false)
    }
  }

  const state = (c: Campaign) => !c.enrollmentOpen ? 'Oprită'
    : c.endsAt && new Date(c.endsAt) <= new Date() ? 'Expirată'
    : c.startsAt && new Date(c.startsAt) > new Date() ? 'Programată' : 'Activă'
  const date = (value: string | null) => value ? new Date(value).toLocaleString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : 'Fără limită'
  const signupUrl = (code: string) => `https://bookeasy.ro/signup?promo=${encodeURIComponent(code)}`

  async function copySignupLink(campaign: Campaign) {
    try {
      await navigator.clipboard.writeText(signupUrl(campaign.code))
      setCopied(campaign.id)
      window.setTimeout(() => setCopied(null), 2500)
    } catch {
      window.prompt('Copiază linkul de înscriere:', signupUrl(campaign.code))
    }
  }

  const funnelGroups = Object.values(funnel.reduce<Record<string, { promoCode: string; utmCampaign: string; view: number; start: number; submit: number; created: number }>>((groups, row) => {
    const key = `${row.promoCode}:${row.utmCampaign}`
    const group = groups[key] ??= { promoCode: row.promoCode, utmCampaign: row.utmCampaign, view: 0, start: 0, submit: 0, created: 0 }
    group[row.step] += row.count
    return groups
  }, {}))

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
    <form id="promotion-form" onSubmit={save} className="card space-y-4 p-5">
      <h2 className="text-lg font-semibold">{restoring ? 'Restaurează campania' : editing ? 'Editează campania' : 'Campanie nouă'}</h2>
      {restoring && <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
        Verifică oferta și perioada. Bifează „Permite înscrieri” pentru a redeschide campania.
      </p>}
      <label className="block text-sm">Numele campaniei
        <input required minLength={2} maxLength={100} className="input-field mt-1 w-full" value={form.name} disabled={busy} onChange={e => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="block text-sm">Cod promoțional
        <input required minLength={3} maxLength={64} pattern="[A-Za-z0-9_\-]+" className="input-field mt-1 w-full uppercase" placeholder="Ex.: IARNA2026" value={form.code} disabled={busy} readOnly={restoring} onChange={e => {
          setForm({ ...form, code: e.target.value.toUpperCase() })
          if (conflict) { setConflict(null); setError('') }
        }} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={form.freeUntilNotice} disabled={busy} onChange={e => setForm({ ...form, freeUntilNotice: e.target.checked })} />
        Gratuit, fără termen stabilit · fără trecere automată la plată
      </label>
      {!form.freeUntilNotice && <>
        <label className="block text-sm">Luni gratuite
          <input type="number" required min={1} max={24} step={1} className="input-field mt-1 w-full" value={form.freeMonths} disabled={busy} onChange={e => setForm({ ...form, freeMonths: Number(e.target.value) })} />
        </label>
        <label className="block text-sm">Tarif ulterior (lei/lună)
          <input type="number" min={0} max={100000} step="0.01" required className="input-field mt-1 w-full" value={form.regularMinor / 100} disabled={busy} onChange={e => setForm({ ...form, regularMinor: Math.round(Number(e.target.value) * 100) })} />
        </label>
      </>}
      <p className="text-xs text-gray-500">Modificările se aplică înscrierilor viitoare. Ofertele deja acceptate se păstrează. {editing && !restoring && 'Schimbarea codului invalidează linkurile care folosesc codul vechi.'}</p>
      {form.freeUntilNotice && <p className="rounded-xl bg-teal-50 p-3 text-xs text-teal-800">Activare și utilizare gratuite. O eventuală ofertă plătită se anunță cu minimum 30 de zile înainte și necesită acceptare expresă. Închiderea înscrierilor nu oprește gratuitatea deja acordată.</p>}
      <label className="block text-sm">Înscrieri începând cu <span className="text-gray-400">(opțional)</span>
        <input type="datetime-local" className="input-field mt-1 w-full" value={form.startsAt} disabled={busy} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
      </label>
      <label className="block text-sm">Înscrieri până la <span className="text-gray-400">(opțional)</span>
        <input type="datetime-local" className="input-field mt-1 w-full" value={form.endsAt} disabled={busy} onChange={e => setForm({ ...form, endsAt: e.target.value })} />
      </label>
      <p className="text-xs text-gray-500">Datele sunt afișate în ora locală a dispozitivului. După data de final, codul nu mai poate fi folosit la înscrieri noi.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enrollmentOpen} disabled={busy} onChange={e => setForm({ ...form, enrollmentOpen: e.target.checked })} />
        Permite înscrieri cu acest cod
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Se salvează...' : restoring ? 'Restaurează campania' : editing ? 'Salvează modificările' : 'Creează codul'}
        </button>
        {editing && <button type="button" disabled={busy} className="btn-secondary" onClick={resetForm}>Anulează</button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {conflict && <button type="button" disabled={busy} className="btn-secondary" onClick={() => startEditing(conflict)}>Continuă cu restaurarea</button>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    </form>

    <section aria-label="Campanii existente" className="space-y-4">
      {!loaded && <p className="text-sm text-gray-500">Se încarcă...</p>}
      {loaded && !currentCampaigns.length && <p className="text-sm text-gray-500">Toate campaniile sunt în arhivă sau nu există încă promoții.</p>}
      {currentCampaigns.map(c => <article key={c.id} className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{c.name}</h2>
            <p className="mt-1 font-mono font-semibold text-teal-700">{c.code}</p>
            <p className="mt-3 text-sm">{c.freeUntilNotice ? 'Gratuit · fără termen stabilit' : `${c.freeMonths} luni gratuite, apoi ${c.regularMinor / 100} lei/lună`}</p>
            <p className="mt-2 text-sm text-gray-500">{c.enrollments} afaceri înscrise</p>
            <dl className="my-3 space-y-1 text-xs text-gray-500">
              <div>Început înscrieri: {date(c.startsAt)}</div><div>Final înscrieri: {date(c.endsAt)}</div>
            </dl>
            <button type="button" disabled={busy} className="btn-secondary text-sm" onClick={() => startEditing({ id: c.id, archived: false }, c)}>Editează</button>
            <button type="button" disabled={busy} className="ml-4 text-sm text-red-700 underline" onClick={() => void remove(c)}>Arhivează</button>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <a href={signupUrl(c.code)} target="_blank" rel="noopener noreferrer" aria-label={`Deschide pagina de înrolare cu codul ${c.code}`} className="rounded-xl border border-gray-200 bg-white p-2">
              <QRCodeSVG value={signupUrl(c.code)} size={148} level="M" marginSize={2} title={`Înscriere cu codul ${c.code}`} />
            </a>
            <span className="text-xs text-gray-500">Scanează pentru înrolare</span>
            <button type="button" className="text-xs font-medium text-teal-700 underline" onClick={() => void copySignupLink(c)}>{copied === c.id ? 'Link copiat ✓' : 'Copiază linkul'}</button>
          </div>
        </div>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${state(c) === 'Activă' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{state(c)}</span>
      </article>)}
      {archivedCampaigns.length > 0 && <details className="card p-5" open={!currentCampaigns.length || undefined}>
        <summary className="cursor-pointer font-semibold">Arhivă ({archivedCampaigns.length})</summary>
        <ul className="mt-3 divide-y">
          {archivedCampaigns.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{c.name} <span className="font-mono text-sm text-teal-700">{c.code}</span></p>
              <p className="text-xs text-gray-500">{c.enrollments} afaceri înscrise · arhivată la {date(c.deletedAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy} className="btn-secondary min-h-11 text-sm" onClick={() => startEditing({ id: c.id, archived: true }, c)}>Restaurează {c.code}</button>
              <button type="button" disabled={busy} aria-label={`Șterge definitiv ${c.code}`} className="min-h-11 px-2 text-sm text-red-700 underline" onClick={() => void remove(c, true)}>Șterge definitiv</button>
            </div>
          </li>)}
        </ul>
      </details>}
      <p className="text-xs text-gray-500">Oprirea sau expirarea unui cod blochează doar înscrierile noi. Afacerile înscrise își păstrează gratuitatea acordată.</p>
    </section>

    <section className="card p-5 xl:col-span-2">
      <h2 className="text-lg font-semibold">Traseul înscrierilor · ultimele 7 zile</h2>
      <p className="mt-1 text-xs text-gray-500">Contoare agregate, nu persoane unice. Înregistrarea este numărată după crearea contului, înainte de confirmarea emailului. Datele apar de la activarea măsurării.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead><tr className="border-b text-gray-500">
            <th className="pb-2">Cod / campanie UTM</th><th className="pb-2">Vizite</th><th className="pb-2">Formular început</th><th className="pb-2">Trimis</th><th className="pb-2">Cont creat</th>
          </tr></thead>
          <tbody>{funnelGroups.map(group => <tr key={`${group.promoCode}:${group.utmCampaign}`} className="border-b last:border-0">
            <td className="py-2 font-medium">{group.promoCode} <span className="block text-xs font-normal text-gray-500">{group.utmCampaign}</span></td>
            <td>{group.view}</td><td>{group.start}</td><td>{group.submit}</td><td className="font-semibold">{group.created}</td>
          </tr>)}</tbody>
        </table>
        {loaded && !funnelGroups.length && <p className="py-4 text-sm text-gray-500">Nu există încă date de măsurare.</p>}
      </div>
    </section>
  </div>
}
