'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'

type Booking = {
  id: string
  customerName: string
  customerId: string
  serviceName: string
  serviceId: string
  staffName: string | null
  resourceName: string | null
  startAt: string
  endAt: string
  status: string
  channel: string
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

export default function ProgramariManager({
  bookings,
  customers,
  services,
  staff,
  filters,
}: {
  bookings: Booking[]
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  staff: { id: string; name: string }[]
  filters: { status: string; q: string }
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/business/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  async function cancelBooking(id: string) {
    if (!confirm('Anulezi această rezervare?')) return
    await fetch(`/api/business/bookings/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-semibold">Programări</h1>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Anulează' : '+ Adaugă programare'}</Button>
      </div>
      <p className="text-sm text-gray-500 mb-6">{bookings.length} programări</p>

      <form method="get" className="flex flex-col sm:flex-row gap-2 mb-5 max-w-lg">
        <Input name="q" defaultValue={filters.q} placeholder="Caută client (nume/telefon)..." />
        <select name="status" defaultValue={filters.status} className="input-field">
          <option value="">Toate statusurile</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filtrează
        </button>
      </form>

      {adding && (
        <NewBookingForm
          customers={customers}
          services={services}
          staff={staff}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <th className="py-3 px-5 font-medium text-gray-500">Client</th>
              <th className="font-medium text-gray-500">Serviciu</th>
              <th className="font-medium text-gray-500">Data</th>
              <th className="font-medium text-gray-500">Angajat/Sală</th>
              <th className="font-medium text-gray-500">Canal</th>
              <th className="font-medium text-gray-500">Status</th>
              <th className="font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]">
                <td className="py-3 px-5 font-medium">{b.customerName}</td>
                <td>{b.serviceName}</td>
                <td className="text-gray-500">{new Date(b.startAt).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="text-gray-500">{b.staffName ?? b.resourceName ?? '—'}</td>
                <td className="text-gray-500">{b.channel}</td>
                <td>
                  <select
                    value={b.status}
                    onChange={(e) => changeStatus(b.id, e.target.value)}
                    className="input-field text-xs py-1"
                    style={{ borderColor: 'transparent', background: 'transparent' }}
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-5">
                  {b.status !== 'CANCELLED' && (
                    <button onClick={() => cancelBooking(b.id)} className="text-xs text-red-600 font-medium">
                      Anulează
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-8">
                  Nicio programare găsită.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}

function NewBookingForm({
  customers,
  services,
  staff,
  onDone,
}: {
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  staff: { id: string; name: string }[]
  onDone: () => void
}) {
  const [customerId, setCustomerId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!customerId || !serviceId || !date) {
      setError('Completează client, serviciu și dată.')
      return
    }
    setSaving(true)
    setError('')

    const service = services.find((s) => s.id === serviceId)
    const start = new Date(date)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    const res = await fetch('/api/business/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        serviceId,
        staffId: staffId || null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      }),
    })

    if (!res.ok) {
      setError('A apărut o eroare. Verifică datele.')
      setSaving(false)
      return
    }

    setSaving(false)
    onDone()
  }

  return (
    <Card className="mb-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Client</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full">
            <option value="">Alege client</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Serviciu</label>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input-field w-full">
            <option value="">Alege serviciu</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Data și ora</label>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full" />
        </div>
        {staff.length > 0 && (
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Angajat (opțional)</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input-field w-full">
              <option value="">Nealocat</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <Button variant="secondary" onClick={submit} disabled={saving}>
        {saving ? 'Se salvează...' : 'Salvează programarea'}
      </Button>
    </Card>
  )
}
