'use client'

import { useEffect, useState } from 'react'
import PromoCodeField,{type PromoOffer} from '@/components/promo-code-field'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function OnboardingStep5() {
  const router = useRouter()
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ freeMonths: number; launchOpen: boolean; freeUntilNotice:boolean; billingAmount:number|null; billingStatus:string } | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoAccepted, setPromoAccepted] = useState(false)
  const [promoOffer,setPromoOffer]=useState<PromoOffer|null>(null)
  useEffect(() => { let active = true; fetchWithTimeout('/api/onboarding').then(async response => { if (!response.ok) throw new Error('Nu am putut încărca abonamentul. Reîncarcă pagina.'); const result = await response.json(); if (active) setInfo(result) }).catch(() => { if (active) setError('Nu am putut încărca abonamentul. Reîncarcă pagina.') }); return () => { active = false } }, [])

  async function finish() {
    if (promoCode.trim()&&(!promoOffer||!promoAccepted)) { setError('Verifică codul și acceptă condițiile ofertei sau șterge codul pentru a continua fără ofertă.'); return }
    setFinishing(true)
    setError('')
    try {
      const response = await fetchWithTimeout('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 5, data: { promoCode: promoCode.trim() || undefined, acceptLaunchTerms: promoAccepted, launchOfferVersion: promoOffer?.version } }),
      })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Configurarea nu a putut fi finalizată.') }
      router.push('/dashboard?onboarded=true')
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Conexiune eșuată. Încearcă din nou.')
      setFinishing(false)
    }
  }

  return (
    <Card>
      <OnboardingProgress step={4} />
      <p className="text-xs text-gray-500 mb-1">Pasul 4 din 4</p>
      <h1 className="text-xl font-semibold mb-1">Aproape gata!</h1>
      <p className="text-sm text-gray-500 mb-6">
        Calendarul, clienții și serviciile sunt pregătite. După activare, poți conecta conturile afacerii din Setări → Integrări.
      </p>

      <div className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">
        {!info ? 'Se încarcă abonamentul…' : info.freeUntilNotice ? 'Activarea și folosirea contului sunt gratuite, fără termen stabilit. Orice plan plătit viitor necesită notificare prealabilă și acceptarea ta.' : info.freeMonths > 0 ? `Oferta deja asociată: ${info.freeMonths} luni gratuite de la finalizarea configurării.` : info.billingStatus==='GRATUIT' ? 'Plan gratuit, fără abonament lunar.' : `Abonamentul asociat: ${info.billingAmount===null?'tarif stabilit separat':info.billingAmount+' lei/lună'}. Dacă ai un cod promoțional, îl poți introduce mai jos. Fără debitare automată.`}
      </div>

      {info && !info.freeUntilNotice && info.freeMonths === 0 && <div className="mt-5"><PromoCodeField value={promoCode} onChange={setPromoCode} open={info.launchOpen} accepted={promoAccepted} onAcceptedChange={setPromoAccepted} onValidated={setPromoOffer} /></div>}

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={() => router.back()}>
          ← Înapoi
        </Button>
        <Button onClick={finish} disabled={finishing || !info}>
          {finishing ? 'Se finalizează...' : 'Intră în dashboard →'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </Card>
  )
}
