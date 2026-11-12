'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { isAppointmentCategory, offerLabel, type BusinessCategory } from '@/lib/business-categories'

type Item = { name: string; durationMin?: string; price?: string; capacity?: string }

export default function Step3Form({ category, existingVenueRooms = 0 }: { category: BusinessCategory; existingVenueRooms?: number }) {
  const router = useRouter()
  const isSalon = isAppointmentCategory(category)
  const offer = offerLabel(category)
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<Item>({ name: '', durationMin: '', price: '', capacity: '' })
  const [loading, setLoading] = useState(false)
  const [showServicePrices, setShowServicePrices] = useState(false)
  const [error, setError] = useState('')

  function addItem() {
    if (!draft.name.trim()) return
    if (isSalon && (!draft.durationMin || Number(draft.durationMin) < 5 || Number(draft.durationMin) > 1440)) {
      setError('Introdu o durată între 5 și 1440 de minute pentru a putea calcula orele disponibile.')
      return
    }
    setError('')
    setItems((prev) => [...prev, draft])
    setDraft({ name: '', durationMin: '', price: '', capacity: '' })
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (category === 'EVENT_VENUE' && items.length === 0 && existingVenueRooms === 0) {
      setError('Adaugă cel puțin o sală înainte de a continua.')
      return
    }
    setLoading(true)
    setError('')
    const services = items.map((i) => ({
      name: i.name,
      durationMin: isSalon && i.durationMin ? Number(i.durationMin) : null,
      price: showServicePrices && i.price ? Number(i.price) : null,
      capacity: !isSalon && i.capacity ? Number(i.capacity) : null,
    }))

    try {
      const response = await fetchWithTimeout('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 3, data: { services, showServicePrices } }),
      })
      if (!response.ok) { const result = await response.json(); throw new Error(typeof result.error === 'string' ? result.error : 'Serviciile nu au putut fi salvate.') }
      router.push('/onboarding/step-5')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Conexiune eșuată. Încearcă din nou.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <OnboardingProgress step={3} />
      <p className="text-xs text-gray-500 mb-1">Pasul 3 din 4</p>
      <h1 className="text-xl font-semibold mb-1">{isSalon ? `Ce ${offer.plural} oferi?` : 'Ce săli ai disponibile?'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isSalon
          ? `Adaugă ${offer.plural} și durata lor pentru orele disponibile online. Le poți completa și mai târziu din ${offer.heading}.`
          : 'Adaugă cel puțin o sală, cu capacitatea ei.'}
      </p>
      {category === 'EVENT_VENUE' && existingVenueRooms > 0 && <p className="mb-4 text-sm text-gray-600">{existingVenueRooms} {existingVenueRooms === 1 ? 'sală salvată' : 'săli salvate'} deja. Poți adăuga alte săli sau continua.</p>}

      <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={showServicePrices} onChange={e => setShowServicePrices(e.target.checked)} /> Afișează prețurile serviciilor (opțional)</label>
      {items.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {items.map((item, i) => (
            <div key={i} className="border border-[var(--border-soft)] rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {isSalon
                    ? `${item.durationMin || '—'} min${showServicePrices && item.price ? ` · ${item.price} lei` : ''}`
                    : `${item.capacity || '—'} persoane${showServicePrices && item.price ? ` · ${item.price} lei` : ''}`}
                </p>
              </div>
              <button onClick={() => removeItem(i)} className="text-gray-400 text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-4">
        <p className="text-sm font-medium mb-2.5">Adaugă {offer.singular}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <Input
            placeholder={`Denumire ${offer.singular}`}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {isSalon ? (
            <Input
              type="number"
              placeholder="Durată obligatorie (min)"
              min={5}
              max={1440}
              value={draft.durationMin}
              onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
            />
          ) : (
            <Input
              type="number"
              placeholder="Capacitate (persoane)"
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
            />
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {showServicePrices && <Input
            type="number"
            placeholder="Preț (lei)"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />}
          <Button type="button" variant="secondary" onClick={addItem}>
            + Adaugă
          </Button>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => router.push('/onboarding/step-2')}>
          ← Înapoi
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Se salvează...' : 'Continuă →'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-3 text-right">{error}</p>}
    </Card>
  )
}
