'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function OnboardingStep5() {
  const router = useRouter()
  const [finishing, setFinishing] = useState(false)

  async function finish() {
    setFinishing(true)
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 5, data: {} }),
    })
    router.push('/dashboard?onboarded=true')
    router.refresh()
  }

  return (
    <Card>
      <OnboardingProgress step={4} />
      <p className="text-xs text-gray-500 mb-1">Pasul 4 din 4</p>
      <h1 className="text-xl font-semibold mb-1">Aproape gata!</h1>
      <p className="text-sm text-gray-500 mb-6">
        Echipa bookeasy.ro conectează canalele (WhatsApp, Instagram, Facebook) pentru tine, ca
        botul să înceapă să răspundă clienților. Din Setări → Canale poți opri/porni oricând un
        canal deja conectat.
      </p>

      <div className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">
        Te contactăm în scurt timp pentru a conecta canalele afacerii tale. Între timp, restul
        aplicației (calendar, clienți, servicii) funcționează normal.
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={() => router.back()}>
          ← Înapoi
        </Button>
        <Button onClick={finish} disabled={finishing}>
          {finishing ? 'Se finalizează...' : 'Intră în dashboard →'}
        </Button>
      </div>
    </Card>
  )
}
