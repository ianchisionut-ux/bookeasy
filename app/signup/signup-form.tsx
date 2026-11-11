'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useEffect, useRef, useState } from 'react'
import {formatPlanPrice,type PlanPrices} from '@/lib/plan-pricing-display'
import PromoCodeField,{type PromoOffer} from '@/components/promo-code-field'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import ClientPageLinks from '@/components/client-page-links'
import { CookiePreferencesButton } from '@/components/cookie-preferences-button'
import { completeSignupPixel, sendSignupFunnel, signupAttribution, startSignupPixel, stopSignupPixel } from '@/lib/signup-analytics-client'
import { COOKIE_CONSENT_CHANGED_EVENT, hasMarketingConsent } from '@/lib/cookie-consent'

export default function SignupForm({ launchOpen, lockedPromoCode,prices }: { launchOpen: boolean; lockedPromoCode?: string;prices:PlanPrices }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState(lockedPromoCode ?? '')
  const [promoAccepted, setPromoAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [promoOffer,setPromoOffer]=useState<PromoOffer|null>(null)
  const hasPromo = Boolean(promoOffer)
  useEffect(()=>{setTermsAccepted(false);setPromoAccepted(false)},[promoOffer?.version])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    sendSignupFunnel('view', lockedPromoCode ?? '')
    startSignupPixel()
    const onConsentChange = () => {
      if (hasMarketingConsent()) startSignupPixel()
      else stopSignupPixel()
    }
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChange)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChange)
  }, [lockedPromoCode])

  function markStarted() {
    if (started.current) return
    started.current = true
    sendSignupFunnel('start', lockedPromoCode ?? promoCode)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if(promoCode.trim()&&(!promoOffer||!promoAccepted)){setError(lockedPromoCode?'Codul din invitație trebuie să fie valid și condițiile ofertei acceptate.':'Verifică codul și acceptă condițiile ofertei sau șterge codul pentru a continua fără ofertă.');return}
    setLoading(true)
    sendSignupFunnel('submit', lockedPromoCode ?? promoCode)
    try {

    const res = await fetchWithTimeout('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, promoCode: promoCode.trim() || undefined, utmCampaign: signupAttribution(promoCode).utmCampaign, acceptSubscriptionTerms: termsAccepted, acceptLaunchTerms: hasPromo ? promoAccepted : undefined, launchOfferVersion: promoOffer?.version, planPriceVersion: prices.version }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error?.password?.[0] ?? data.error ?? 'A apărut o eroare.')
      setLoading(false)
      return
    }

    completeSignupPixel()
    router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}${data.emailSent === false ? '&delivery=failed' : ''}`)
    router.refresh()
    } catch {
      setError('Conexiunea a eșuat. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="public-flow-page themed-static-bg min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={32} height={32} />
          <span className="font-semibold text-lg">bookeasy.ro</span>
        </Link>

        <Card className="w-full">
          <h1 className="text-lg font-semibold mb-1">Creează cont</h1>
          <p className="text-sm text-gray-500 mb-4">Creezi contul, confirmi adresa de email, apoi configurezi afacerea ta.</p>

          <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label htmlFor="signup-email" className="text-sm text-gray-500 block mb-1.5">Email</label>
              <Input id="signup-email" type="email" autoComplete="email" value={email} onFocus={markStarted} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="signup-password" className="text-sm text-gray-500 block mb-1.5">Parolă</label>
              <Input
                type="password"
                id="signup-password"
                autoComplete="new-password"
                value={password}
                onFocus={markStarted}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <PromoCodeField value={promoCode} onChange={setPromoCode} open={launchOpen} onValidated={setPromoOffer} locked={Boolean(lockedPromoCode)} />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-600"><input type="checkbox" checked={termsAccepted} onChange={event => {setTermsAccepted(event.target.checked);setPromoAccepted(event.target.checked&&hasPromo)}} disabled={Boolean(promoCode.trim())&&!promoOffer} required className="mt-0.5" /><span>Accept <Link href="/termeni-si-conditii" className="underline" target="_blank" rel="noopener noreferrer">termenii de utilizare</Link>{promoOffer?.freeUntilNotice?<> și <Link href="/legal/termeni#campanie-gratuita" className="underline" target="_blank" rel="noopener noreferrer">condițiile campaniei gratuite</Link>, fără obligație de plată. Un plan plătit viitor necesită notificare cu minimum 30 de zile înainte și acordul meu expres.</>:promoCode.trim()&&!promoOffer?' și oferta care va fi afișată după verificarea codului.':promoOffer?` și oferta validată: ${promoOffer.freeMonths} luni gratuite, apoi ${formatPlanPrice(promoOffer.regularMinor)}.`:` și abonamentul Standard de ${formatPlanPrice(prices.standardMinor)}. Pot solicita oprirea înaintea următoarei perioade.`}</span></label>

            <Button type="submit" disabled={loading||(Boolean(promoCode.trim())&&!promoOffer)} className="mt-2">
              {loading ? 'Se creează contul...' : 'Creează cont'}
            </Button>
          </form>
        </Card>
        <Link href="/login" className="text-sm text-[var(--accent-hover)] hover:underline">Ai deja o afacere? Intră în cont</Link>
        <ClientPageLinks />
        <CookiePreferencesButton className="text-xs text-gray-500 underline hover:text-[var(--accent-hover)]" />
      </div>
    </main>
  )
}
