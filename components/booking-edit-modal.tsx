'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'

export type BookingDetail = {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  serviceName: string
  practitionerName?: string | null
  startAt: string
  endAt: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  confirmationRequestSent?: boolean
  customerConfirmed?: boolean | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'În așteptare',
  CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată',
  COMPLETED: 'Finalizată',
  NO_SHOW: 'Neprezentare',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
  NO_SHOW: 'danger',
}

export default function BookingEditModal({
  booking,
  onClose,
}: {
  booking: BookingDetail
  onClose: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState(booking.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingPatient, setEditingPatient] = useState(false)
  const [patientName, setPatientName] = useState(booking.customerName)
  const [patientPhone, setPatientPhone] = useState(booking.customerPhone)
  const [savingPatient, setSavingPatient] = useState(false)

  async function savePatientInfo() {
    setSavingPatient(true)
    try {
      const res = await fetchWithTimeout(`/api/customers/${booking.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: patientName, phone: patientPhone }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut salva datele.')
        return
      }
      setEditingPatient(false)
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSavingPatient(false)
    }
  }

  function formatDateInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [startAt, setStartAt] = useState(formatDateInput(booking.startAt))

  async function save() {
    setSaving(true)
    setError('')
    const durationMs = new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()
    const newStart = new Date(startAt)
    const newEnd = new Date(newStart.getTime() + durationMs)

    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Nu am putut salva modificările.')
        return
      }

      router.refresh()
      onClose()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelBooking() {
    if (!confirm('Anulezi această rezervare?')) return
    setSaving(true)
    try {
      await fetchWithTimeout(`/api/business/bookings/${booking.id}`, { method: 'DELETE' })
      router.refresh()
      onClose()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">{booking.serviceName}</h2>
          <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
        </div>
        <div className="mb-4">
          {editingPatient ? (
            <div className="flex flex-col gap-2">
              <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nume" className="input-field w-full text-sm" />
              <input type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Telefon" className="input-field w-full text-sm" />
              <div className="flex gap-2">
                <button onClick={savePatientInfo} disabled={savingPatient} className="text-xs text-[var(--accent)] font-medium">
                  {savingPatient ? 'Se salvează...' : 'Salvează'}
                </button>
                <button onClick={() => setEditingPatient(false)} className="text-xs text-gray-500">
                  Anulează
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">{booking.customerName}</p>
                <p className="text-xs text-gray-500">
                  📞 {booking.customerPhone}
                  {booking.practitionerName && <> · 🩺 {booking.practitionerName}</>}
                </p>
                {booking.confirmationRequestSent && booking.status === 'CONFIRMED' && (
                  <p className="text-xs mt-0.5" style={{ color: booking.customerConfirmed ? '#16a34a' : '#eab308' }}>
                    {booking.customerConfirmed ? '✓ Confirmată de client' : '⏳ Așteaptă confirmare de la client'}
                  </p>
                )}
              </div>
              <button onClick={() => setEditingPatient(true)} className="text-xs text-[var(--accent)] font-medium">
                Editează
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Data și ora</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input-field w-full">
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex justify-between mt-5">
          <button onClick={cancelBooking} disabled={saving} className="text-sm text-red-600 font-medium">
            Anulează rezervarea
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Închide
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
