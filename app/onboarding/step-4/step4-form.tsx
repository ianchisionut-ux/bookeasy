'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function Step4Form() {
  const router = useRouter()
  const [names, setNames] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  function addStaff() {
    if (!draft.trim()) return
    setNames((prev) => [...prev, draft.trim()])
    setDraft('')
  }

  async function submit(staffList: string[]) {
    setLoading(true)
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 4, data: { staff: staffList.map((name) => ({ name })) } }),
    })
    router.push('/onboarding/step-5')
  }

  return (
    <Card>
      <OnboardingProgress step={4} />
      <p className="text-xs text-gray-500 mb-1">Pasul 4 din 5</p>
      <h1 className="text-xl font-semibold mb-1">Cine face parte din echipă?</h1>
      <p className="text-sm text-gray-500 mb-6">Opțional — poți adăuga angajați și mai târziu din dashboard.</p>

      {names.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {names.map((n, i) => (
            <span key={i} className="pill bg-[var(--accent-soft)] text-[var(--accent)] text-sm px-3 py-1.5">
              {n}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Nume angajat"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStaff())}
        />
        <Button type="button" variant="secondary" onClick={addStaff}>
          + Adaugă
        </Button>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => router.push('/onboarding/step-3')}>
          ← Înapoi
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => submit([])} disabled={loading}>
            Sari peste
          </Button>
          <Button onClick={() => submit(names)} disabled={loading || names.length === 0}>
            {loading ? 'Se salvează...' : 'Continuă →'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
