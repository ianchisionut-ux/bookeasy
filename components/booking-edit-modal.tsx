'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'

export type BookingDetail = {
  id: string
  customerName: string
  serviceName: string
  startAt: string
  endAt: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
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

  function formatDateInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [startAt, setStartAt] = useState(formatDateInput(booking.startAt))

  async function save() {
    setSaving(true)
    const durationMs = new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()
    const newStart = new Date(startAt)
    const newEnd = new Date(newStart.getTime() + durationMs)

    const res = await fetch(`/api/business/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Nu am putut salva modificările.')
      return
    }

    router.refresh()
    onClose()
  }

  async function cancelBooking() {
    if (!confirm('Anulezi această rezervare?')) return
    setSaving(true)
    await fetch(`/api/business/bookings/${booking.id}`, { method: 'DELETE' })
    setSaving(false)
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-6" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">{booking.serviceName}</h2>
          <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
        </div>
        <p className="text-sm text-gray-500 mb-4">{booking.customerName}</p>

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
