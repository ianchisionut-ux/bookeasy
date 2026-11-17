'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

type Series = {
  id: string
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  untilDate: string
  nextAt: string
  remaining: number
  serviceName: string
  practitionerName: string | null
}

const frequencyLabels = { WEEKLY: 'Săptămânal', BIWEEKLY: 'La 2 săptămâni', MONTHLY: 'Lunar' }

export default function BookingSeriesCard({ customerId, series, isClinic }: { customerId: string; series: Series[]; isClinic: boolean }) {
  const router = useRouter()
  const [stoppingId, setStoppingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function stop(id: string) {
    if (!confirm('Anulezi toate programările viitoare din această serie? Programările trecute rămân în istoric.')) return
    setStoppingId(id)
    setError('')
    try {
      const response = await fetch(`/api/business/booking-series/${id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Seria nu a putut fi oprită.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conexiune eșuată.')
    } finally {
      setStoppingId(null)
    }
  }

  return <Card className="mb-6 screen-only">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-medium">Programări recurente</h2>
        <p className="text-sm text-gray-500">Rezervă același interval pentru vizitele regulate.</p>
      </div>
      <Link className="btn-primary inline-flex min-h-10 items-center text-sm" href={`/dashboard/programari?add=1&customerId=${encodeURIComponent(customerId)}`}>
        + Programează {isClinic ? 'pacientul' : 'clientul'}
      </Link>
    </div>
    {series.length > 0 ? <div className="mt-4 space-y-3">
      {series.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] p-3">
        <div>
          <p className="font-medium">{item.serviceName}{item.practitionerName ? ` · ${item.practitionerName}` : ''}</p>
          <p className="text-sm text-gray-600">{frequencyLabels[item.frequency]} · următoarea: {new Date(item.nextAt).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', hour12: false })}</p>
          <p className="text-xs text-gray-500">{item.remaining} viitoare · până la {new Date(`${item.untilDate}T12:00:00Z`).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })}</p>
        </div>
        <button type="button" onClick={() => stop(item.id)} disabled={stoppingId === item.id} className="text-sm font-medium text-red-600 disabled:opacity-50">
          {stoppingId === item.id ? 'Se anulează...' : 'Anulează seria viitoare'}
        </button>
      </div>)}
    </div> : <p className="mt-4 text-sm text-gray-500">Nu există serii active.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </Card>
}
