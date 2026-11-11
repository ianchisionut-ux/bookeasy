'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {formatPlanPrice,type PlanPrices} from '@/lib/plan-pricing-display'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import PromoCodeField, { type PromoOffer } from '@/components/promo-code-field'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type InvitationInfo = { email: string; name: string; offeredPlan: 'FREE' | 'STANDARD' | 'PRO' | 'CAMPAIGN'; promoCode: string | null; existing: boolean;prices:PlanPrices }
const description = {
  FREE: 'Plan FREE, fără abonament lunar.',
  STANDARD: '',
  PRO: 'Plan PRO, cu tariful și facturarea stabilite separat cu echipa BookEasy.',
  CAMPAIGN: 'Campanie cu acces PRO și gratuitatea precizată în ofertă.',
}

export default function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [promo, setPromo] = useState('')
  const [offer, setOffer] = useState<PromoOffer | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    fetchWithTimeout('/api/invitations/' + encodeURIComponent(token)).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (active) { setInfo(data.invitation); setPromo(data.invitation.promoCode ?? '') }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Invitația nu poate fi verificată.') })
    return () => { active = false }
  }, [token])

  async function accept(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (info?.offeredPlan === 'CAMPAIGN' && (!offer || !accepted)) { setError('Verifică oferta și acceptă condițiile campaniei.'); return }
    setBusy(true)
    try {
      const response = await fetchWithTimeout('/api/invitations/' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info?.existing ? {} : { password, acceptTerms: terms, promoCode: info?.offeredPlan === 'CAMPAIGN' ? promo : undefined, acceptPromo: accepted, offerVersion: offer?.version,planPriceVersion:info?.prices.version }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setDone(true)
      if (!data.existing && info) {
        try {
          const login = await signIn('credentials', { email: info.email, password, accountType: 'business', redirect: false })
          if (login?.ok && !login.error) { router.push('/dashboard'); router.refresh() }
        } catch { /* Contul este creat; linkul de conectare rămâne disponibil. */ }
      }
      setPassword('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Conexiune întreruptă.') }
    finally { setBusy(false) }
  }

  return <main className="public-flow-page themed-static-bg flex min-h-screen items-center justify-center px-5 py-10"><section className="card w-full max-w-md p-6 text-center">
    <Link href="/" className="font-semibold text-teal-700">bookeasy.ro</Link><h1 className="mt-5 text-2xl font-semibold">Continuă înrolarea afacerii</h1>
    {done ? <><p className="my-5 text-sm text-gray-600">Adresa de email a fost confirmată. Intră în cont pentru a continua configurarea afacerii tale.</p><Link className="btn-primary inline-flex" href="/login">Intră în cont și continuă</Link></> : info ? <form onSubmit={accept} className="mt-5 space-y-4 text-left">
      <p className="text-center text-sm text-gray-600">{info.name || 'Afacerea ta'} · {info.email}</p>
      {!info.existing && <p className="rounded-xl bg-[var(--accent-soft)] p-3 text-sm font-medium">{info.offeredPlan==='STANDARD'?`Plan STANDARD · ${formatPlanPrice(info.prices.standardMinor)} după configurare.`:info.offeredPlan==='PRO'?`Plan PRO · ${formatPlanPrice(info.prices.proMinor)}`:description[info.offeredPlan]}</p>}
      {info.existing ? <p className="text-sm text-gray-600">Ai deja un cont de afacere. Confirmă invitația, apoi conectează-te cu parola existentă. Parola ta rămâne neschimbată.</p> : <>
        <label className="block text-sm">Alege parola<input type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="input-field mt-1 w-full" value={password} onChange={event => setPassword(event.target.value)} /></label>
        {info.offeredPlan === 'CAMPAIGN' && <PromoCodeField value={promo} onChange={setPromo} onValidated={setOffer} locked />}
        <label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" required checked={terms} onChange={event => {setTerms(event.target.checked);setAccepted(event.target.checked&&Boolean(offer))}} disabled={info.offeredPlan==='CAMPAIGN'&&!offer} /><span>Accept <Link href="/termeni-si-conditii" target="_blank" rel="noopener noreferrer" className="underline">condițiile planului</Link> {offer?.freeUntilNotice?<>și <Link href="/legal/termeni#campanie-gratuita" className="underline" target="_blank" rel="noopener noreferrer">condițiile campaniei gratuite</Link>: fără obligație de plată; un tarif viitor necesită notificare cu minimum 30 de zile înainte și acordul meu expres.</>:info.offeredPlan} și <Link href="/legal/confidentialitate" target="_blank" rel="noopener noreferrer" className="underline">politica de confidențialitate</Link>.</span></label>
      </>}
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Se procesează...' : info.existing ? 'Confirmă și continuă' : 'Creează contul și continuă'}</button>
      {info.existing && <Link href="/forgot-password" className="block text-center text-sm text-teal-700">Ai uitat parola?</Link>}
    </form> : !error && <p className="mt-5 text-sm text-gray-500">Se verifică invitația...</p>}
    {error && <div className="mt-4"><p role="alert" className="text-sm text-red-700">{error}</p><Link href="/login" className="mt-3 inline-block text-sm text-teal-700 underline">Ai deja cont? Intră în cont</Link></div>}
  </section></main>
}
