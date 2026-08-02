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
      <OnboardingProgress step={5} />
      <p className="text-xs text-gray-500 mb-1">Pasul 5 din 5</p>
      <h1 className="text-xl font-semibold mb-1">Conectează un canal</h1>
      <p className="text-sm text-gray-500 mb-6">
        Botul răspunde automat clienților doar pe canale conectate. Poți conecta WhatsApp acum, sau mai
        târziu din Setări → Canale — restul aplicației funcționează normal între timp.
      </p>

      <div className="flex flex-col gap-3">
        <a href="/api/oauth/meta/start" className="card card-interactive p-4 flex items-center gap-3 no-underline">
          <span className="text-2xl">💬</span>
          <div>
            <p className="font-medium text-sm">Conectează WhatsApp Business</p>
            <p className="text-xs text-gray-500">Necesită un cont Meta Business verificat</p>
          </div>
        </a>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="secondary" onClick={() => router.back()}>
          ← Înapoi
        </Button>
        <Button onClick={finish} disabled={finishing}>
          {finishing ? 'Se finalizează...' : 'Sari peste, intră în dashboard →'}
        </Button>
      </div>
    </Card>
  )
}
