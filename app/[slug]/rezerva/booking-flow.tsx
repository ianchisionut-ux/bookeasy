'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Service = {
  id: string
  name: string
  durationMin: number | null
  price: number | null
  requiresDeposit: boolean
  depositAmount: number | null
}

type DaySlot = { time: string; available: boolean }

const STORAGE_KEY = 'bookeasy_customer_info'

function buildNextDays(count: number) {
  const days: Date[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function toDateParam(d: Date) {
  // NU folosim toISOString() aici — convertește la UTC și, pentru fusul României
  // (UTC+2/+3), miezul nopții local "alunecă" înapoi cu o zi. Extragem direct
  // componentele locale ale datei, fără nicio conversie de fus orar.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function BookingFlow({
  businessId,
  businessSlug,
  category,
  services,
  canPayOnline,
  accentColor,
  accentSoftColor,
}: {
  businessId: string
  businessSlug: string
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE'
  services: Service[]
  canPayOnline: boolean
  accentColor: string
  accentSoftColor: string
}) {
  const isAppointment = category === 'SALON'
  const days = useMemo(() => buildNextDays(30), [])

  const [service, setService] = useState<Service | null>(services[0] ?? null)
  const [selectedDate, setSelectedDate] = useState<Date>(days[0])
  const [daySlots, setDaySlots] = useState<DaySlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const daysScrollRef = useRef<HTMLDivElement>(null)

  function scrollDays(direction: 'left' | 'right') {
    daysScrollRef.current?.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  // reîncărcăm numele/telefonul salvate dintr-o rezervare anterioară pe acest browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { name: savedName, phone: savedPhone } = JSON.parse(saved)
        setName(savedName ?? '')
        setPhone(savedPhone ?? '')
      }
    } catch {
      // localStorage indisponibil (mod privat etc.) — pornim de la câmpuri goale
    }
  }, [])

  // reîncarcă sloturile zilei de fiecare dată când se schimbă serviciul sau data aleasă
  useEffect(() => {
    if (!isAppointment || !service) return
    setLoadingSlots(true)
    setSelectedSlot(null)
    setError('')

    fetchWithTimeout(`/api/public/availability?businessId=${businessId}&serviceId=${service.id}&date=${toDateParam(selectedDate)}`)
      .then((res) => res.json())
      .then((data) => setDaySlots(data.allSlots ?? []))
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [service, selectedDate, businessId, isAppointment])

  function selectService(s: Service) {
    setService(s)
  }

  async function submitBooking() {
    if (!service) {
      setError('Alege un serviciu.')
      return
    }
    if (isAppointment && !selectedSlot) {
      setError('Alege o oră disponibilă.')
      return
    }
    if (!name.trim() || phone.trim().length < 6) {
      setError('Completează numele și un număr de telefon valid.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }))
    } catch {
      // ignorăm dacă localStorage nu e disponibil
    }

    const startAt = isAppointment ? selectedSlot! : new Date(`${toDateParam(selectedDate)}T00:00:00`).toISOString()

    try {
      const res = await fetchWithTimeout('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          serviceId: service.id,
          startAt,
          customerName: name,
          customerPhone: phone,
          paymentMethod,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare. Te rugăm încearcă din nou.')
        return
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      setDone(true)
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card>
        <h2 className="text-lg font-semibold mb-1">Rezervare confirmată! 🎉</h2>
        <p className="text-sm text-gray-600">Te așteptăm — vei primi confirmarea și pe telefonul indicat.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alege serviciul */}
      <div>
        <h2 className="font-semibold mb-3">{isAppointment ? 'Alege serviciul' : 'Alege sala/pachetul'}</h2>
        <div className="flex flex-col gap-2">
          {services.map((s) => {
            const active = service?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => selectService(s)}
                className="text-left p-3.5 rounded-2xl border transition"
                style={{
                  borderColor: active ? accentColor : 'var(--border-soft)',
                  background: active ? accentSoftColor : 'white',
                }}
              >
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isAppointment && s.durationMin ? `${s.durationMin} min · ` : ''}
                  {s.price ? `${s.price} lei` : ''}
                </p>
              </button>
            )
          })}
          {services.length === 0 && <p className="text-sm text-gray-500">Momentan niciun serviciu disponibil.</p>}
        </div>
      </div>

      {/* Alege data — carusel orizontal de zile */}
      <div>
        <h2 className="font-semibold mb-3">Alege data</h2>
        <div className="relative flex items-center gap-1">
          <button
            onClick={() => scrollDays('left')}
            aria-label="Zile anterioare"
            className="hidden sm:flex shrink-0 w-8 h-8 rounded-full border border-[var(--border-soft)] items-center justify-center bg-white hover:bg-gray-50"
          >
            ‹
          </button>
          <div ref={daysScrollRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
            {days.map((d) => {
              const active = toDateParam(d) === toDateParam(selectedDate)
              const dayName = d.toLocaleDateString('ro-RO', { weekday: 'short', timeZone: 'Europe/Bucharest' })
              const dayNum = d.getDate()
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className="shrink-0 w-16 py-2.5 rounded-2xl border text-center transition"
                  style={{
                    borderColor: active ? accentColor : 'var(--border-soft)',
                    background: active ? accentColor : 'white',
                    color: active ? 'white' : 'var(--foreground)',
                  }}
                >
                  <p className="text-xs uppercase" style={{ opacity: active ? 0.85 : 0.6 }}>
                    {dayName.replace('.', '')}
                  </p>
                  <p className="text-lg font-semibold leading-tight">{dayNum}</p>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => scrollDays('right')}
            aria-label="Zile următoare"
            className="hidden sm:flex shrink-0 w-8 h-8 rounded-full border border-[var(--border-soft)] items-center justify-center bg-white hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      </div>

      {/* Alege ora — doar pentru servicii de tip programare */}
      {isAppointment && (
        <div>
          <h2 className="font-semibold mb-3">Alege ora</h2>
          {loadingSlots ? (
            <p className="text-sm text-gray-500">Se încarcă orele...</p>
          ) : daySlots.length === 0 ? (
            <p className="text-sm text-gray-500">Nicio oră de lucru în această zi. Alege altă dată.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {daySlots.map((slot) => {
                const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
                const active = selectedSlot === slot.time
                if (!slot.available) {
                  return (
                    <span
                      key={slot.time}
                      className="py-2.5 rounded-xl text-center text-sm text-gray-300 border border-[var(--border-soft)] line-through select-none"
                    >
                      {time}
                    </span>
                  )
                }
                return (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedSlot(slot.time)}
                    className="py-2.5 rounded-xl text-center text-sm font-medium border transition"
                    style={{
                      borderColor: active ? accentColor : 'var(--border-soft)',
                      background: active ? accentColor : 'white',
                      color: active ? 'white' : 'var(--foreground)',
                    }}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detaliile tale */}
      <div>
        <h2 className="font-semibold mb-3">Detaliile tale</h2>
        <div className="flex flex-col gap-2">
          <Input placeholder="Numele tău" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Telefon" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      {/* Plată, dacă e cazul */}
      {canPayOnline && service?.requiresDeposit && (
        <div>
          <h2 className="font-semibold mb-3">Plată</h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className="p-3.5 rounded-2xl border text-left flex items-center justify-between"
              style={{ borderColor: paymentMethod === 'CASH' ? accentColor : 'var(--border-soft)' }}
            >
              <span className="font-medium">Numerar la locație</span>
            </button>
            <button
              onClick={() => setPaymentMethod('ONLINE')}
              className="p-3.5 rounded-2xl border text-left flex items-center justify-between"
              style={{ borderColor: paymentMethod === 'ONLINE' ? accentColor : 'var(--border-soft)' }}
            >
              <span className="font-medium">Card online</span>
              <span className="text-sm text-gray-500">Avans {service.depositAmount} lei</span>
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        onClick={submitBooking}
        disabled={submitting}
        className="w-full py-3.5 text-base"
        style={{ background: accentColor, borderColor: accentColor }}
      >
        {submitting ? 'Se trimite...' : 'Confirmă rezervarea'}
      </Button>
    </div>
  )
}
