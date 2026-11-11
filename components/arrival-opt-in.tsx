'use client'

import { useState } from 'react'
import { readClientArrivals, writeClientArrivals, type ClientArrival } from '@/lib/client-arrival'
import { requestClientPosition } from '@/lib/client-geolocation'

export default function ArrivalOptIn({ arrival }: { arrival: ClientArrival }) {
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function activate() {
    if (loading || active) return
    setLoading(true)
    setError('')
    try {
      const existing = readClientArrivals()
      if (!existing.some((entry) => entry.bookingId === arrival.bookingId)) {
        const position = await requestClientPosition(true, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 })
        if (!position) {
          setError('Locația nu este disponibilă. Programarea rămâne confirmată; poți activa anunțul de sosire mai târziu.')
          return
        }
        writeClientArrivals([...readClientArrivals().filter((entry) => entry.bookingId !== arrival.bookingId), arrival])
      }
      setActive(true)
    } catch {
      setError('Nu am putut activa anunțul de sosire pe acest dispozitiv. Programarea rămâne confirmată.')
    } finally { setLoading(false) }
  }

  return <section className="mx-auto mt-6 max-w-lg rounded-2xl border border-teal-100 bg-teal-50 p-5 text-center" aria-label="Anunț de sosire">
    <h3 className="font-semibold">Anunță automat când ajungi</h3>
    <p className="mt-2 text-sm text-gray-600">Opțional, verificăm locația doar cât BookEasy este deschis, în apropierea programării. Poți opri oricând anunțul de sosire.</p>
    {active ? <p className="mt-3 text-sm font-semibold text-teal-700" role="status">Anunțul de sosire este activ.</p>
      : <div className="public-flow-actions mt-4"><button type="button" className="btn-primary" onClick={activate} disabled={loading}>{loading ? 'Se activează…' : 'Activează anunțul de sosire'}</button></div>}
    {error && <p className="mt-3 text-sm text-gray-600" role="status">{error}</p>}
  </section>
}

