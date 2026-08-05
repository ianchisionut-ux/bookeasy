'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Service = {
  id: string
  name: string
  durationMin: number | null
  price: number | null
  requiresDeposit: boolean
  depositAmount: number | null
}

type Step = 'SERVICE' | 'DATE' | 'TIME' | 'DETAILS' | 'PAYMENT' | 'DONE'

const STORAGE_KEY = 'bookeasy_customer_info'

export default function BookingFlow({
  businessId,
  businessSlug,
  category,
  services,
  canPayOnline,
}: {
  businessId: string
  businessSlug: string
  category: 'SALON' | 'EVENT_VENUE'
  services: Service[]
  canPayOnline: boolean
}) {
  const [step, setStep] = useState<Step>('SERVICE')
  const [service, setService] = useState<Service | null>(null)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isAppointment = category === 'SALON'

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
      // localStorage indisponibil (mod privat etc.) — pornim pur și simplu de la câmpuri goale
    }
  }, [])

  function selectService(s: Service) {
    setService(s)
    setStep('DATE')
  }

  async function selectDate(d: string) {
    // atributul HTML `min` nu e mereu respectat de picker-ele native pe mobil —
    // verificăm explicit și aici, ca să nu se poată rezerva niciodată o dată trecută
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const picked = new Date(`${d}T00:00:00`)
    if (picked < todayStart) {
      setError('Nu poți alege o dată din trecut. Alege azi sau o dată viitoare.')
      return
    }

    setDate(d)
    setLoadingSlots(true)
    setError('')
    const res = await fetch(`/api/public/availability?businessId=${businessId}&serviceId=${service!.id}&date=${d}`)
    const data = await res.json()
    setSlots(data.slots ?? [])
    setLoadingSlots(false)
    setStep('TIME')
  }

  function selectSlot(slot: string) {
    setSelectedSlot(slot)
    setStep('DETAILS')
  }

  function confirmDetails() {
    if (!name.trim() || phone.trim().length < 6) {
      setError('Completează numele și un număr de telefon valid.')
      return
    }
    setError('')
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }))
    } catch {
      // ignorăm dacă localStorage nu e disponibil
    }
    setStep('PAYMENT')
  }

  async function submitBooking() {
    setSubmitting(true)
    setError('')

    const startAt = isAppointment ? selectedSlot! : new Date(`${date}T00:00:00`).toISOString()

    const res = await fetch('/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        serviceId: service!.id,
        startAt,
        customerName: name,
        customerPhone: phone,
        paymentMethod,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'A apărut o eroare. Te rugăm încearcă din nou.')
      setSubmitting(false)
      return
    }

    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl
      return
    }

    setSubmitting(false)
    setStep('DONE')
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-5">
      {/* progres simplu */}
      {step !== 'DONE' && (
        <div className="flex items-center gap-1.5">
          {['SERVICE', 'DATE', 'TIME', 'DETAILS', 'PAYMENT'].map((s, i) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full"
              style={{
                background: ['SERVICE', 'DATE', 'TIME', 'DETAILS', 'PAYMENT'].indexOf(step) >= i ? 'var(--accent)' : 'var(--border-soft)',
              }}
            />
          ))}
        </div>
      )}

      {step === 'SERVICE' && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">{isAppointment ? 'Selectează serviciul' : 'Alege sala/pachetul'}</h2>
          <div className="flex flex-col gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => selectService(s)}
                className="card card-interactive text-left p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{s.name}</p>
                  {isAppointment && s.durationMin && (
                    <p className="text-sm text-gray-500 mt-0.5">{s.durationMin} min.</p>
                  )}
                  {s.price && <p className="font-semibold text-base mt-2">{s.price} lei</p>}
                </div>
                <span className="shrink-0 w-9 h-9 rounded-full border border-[var(--border-soft)] flex items-center justify-center text-lg text-gray-700">
                  +
                </span>
              </button>
            ))}
            {services.length === 0 && <p className="text-sm text-gray-500">Momentan niciun serviciu disponibil.</p>}
          </div>
        </Card>
      )}

      {step === 'DATE' && service && (
        <Card>
          <h2 className="font-medium mb-1">Alege data</h2>
          <p className="text-sm text-gray-500 mb-3">{service.name}</p>
          <input
            type="date"
            min={todayStr}
            value={date}
            onChange={(e) => selectDate(e.target.value)}
            className="input-field w-full"
          />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="flex justify-start mt-4">
            <Button variant="secondary" onClick={() => setStep('SERVICE')}>
              ← Înapoi
            </Button>
          </div>
        </Card>
      )}

      {step === 'TIME' && service && (
        <Card>
          <h2 className="font-medium mb-1">{isAppointment ? 'Alege ora' : 'Disponibilitate'}</h2>
          <p className="text-sm text-gray-500 mb-3">
            {service.name} · {new Date(`${date}T00:00:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          {loadingSlots && <p className="text-sm text-gray-500">Se verifică disponibilitatea...</p>}

          {!loadingSlots && isAppointment && (
            <div className="grid grid-cols-3 gap-2.5">
              {slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => selectSlot(slot)}
                  className="card card-interactive text-sm font-medium py-2.5 text-center"
                >
                  {new Date(slot).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })}
                </button>
              ))}
              {slots.length === 0 && <p className="col-span-3 text-sm text-gray-500">Nicio oră liberă în această zi. Alege altă dată.</p>}
            </div>
          )}

          {!loadingSlots && !isAppointment && (
            <div>
              {slots.length > 0 ? (
                <button onClick={() => selectSlot(date)} className="card card-interactive p-4 w-full text-left">
                  <p className="font-medium text-green-700">✓ Disponibil în această zi</p>
                  <p className="text-sm text-gray-500">Apasă pentru a continua rezervarea</p>
                </button>
              ) : (
                <p className="text-sm text-gray-500">Data aleasă nu e disponibilă. Alege altă zi.</p>
              )}
            </div>
          )}

          <div className="flex justify-start mt-4">
            <Button variant="secondary" onClick={() => setStep('DATE')}>
              ← Înapoi
            </Button>
          </div>
        </Card>
      )}

      {step === 'DETAILS' && (
        <Card>
          <h2 className="font-medium mb-3">Datele tale</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Nume</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Numele tău" />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Telefon</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" type="tel" inputMode="tel" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setStep('TIME')}>
              ← Înapoi
            </Button>
            <Button onClick={confirmDetails}>Continuă →</Button>
          </div>
        </Card>
      )}

      {step === 'PAYMENT' && service && (
        <Card>
          <h2 className="font-medium mb-3">Cum plătești?</h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className="card p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-left"
              style={{ border: paymentMethod === 'CASH' ? '2px solid var(--accent)' : undefined }}
            >
              <span className="font-medium">Numerar la locație</span>
              <span className="text-sm text-gray-500">Plătești când ajungi</span>
            </button>

            {canPayOnline && (
              <button
                onClick={() => setPaymentMethod('ONLINE')}
                className="card p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-left"
                style={{ border: paymentMethod === 'ONLINE' ? '2px solid var(--accent)' : undefined }}
              >
                <span className="font-medium">Card online</span>
                <span className="text-sm text-gray-500">
                  {service.requiresDeposit && service.depositAmount ? `Avans ${service.depositAmount} lei` : `${service.price ?? ''} lei`}
                </span>
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex justify-between mt-4">
            <Button variant="secondary" onClick={() => setStep('DETAILS')}>
              ← Înapoi
            </Button>
            <Button onClick={submitBooking} disabled={submitting}>
              {submitting ? 'Se procesează...' : paymentMethod === 'ONLINE' ? 'Plătesc acum' : 'Confirmă rezervarea'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'DONE' && (
        <Card className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl mx-auto mb-3">✓</div>
          <h2 className="font-medium mb-1">Rezervare confirmată!</h2>
          <p className="text-sm text-gray-500">
            Te așteptăm{paymentMethod === 'CASH' ? ' — plata se face la locație.' : '.'} Îți recomandăm să salvezi datele.
          </p>
        </Card>
      )}
    </div>
  )
}
