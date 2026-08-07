'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import { PrintButton } from '@/components/print-button'

type Booking = {
  id: string
  sequenceNumber: number | null
  customerName: string
  customerPhone: string
  customerId: string
  serviceName: string
  serviceId: string
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

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  GOOGLE_BUSINESS: 'Google',
  WEB: 'Site',
  MANUAL: 'Manual',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
  NO_SHOW: 'danger',
}

// aceleași culori ca în calendar, ca statusul să se recunoască vizual instant în ambele locuri
const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#16a34a',
  PENDING: '#eab308',
  CANCELLED: '#ef4444',
  COMPLETED: '#6b7280',
  NO_SHOW: '#ef4444',
}

export default function ProgramariManager({
  category,
  bookings,
  customers,
  services,
  blockedSlots,
  filters,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  bookings: Booking[]
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  blockedSlots: { startAt: string; endAt: string }[]
  filters: { status: string; q: string }
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  async function changeStatus(id: string, status: string) {
    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut actualiza statusul.')
        return
      }
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  async function cancelBooking(id: string) {
    if (!confirm('Anulezi această rezervare?')) return
    try {
      await fetchWithTimeout(`/api/business/bookings/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-semibold">Programări</h1>
        <div className="flex gap-2">
          <PrintButton />
          <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Anulează' : '+ Adaugă programare'}</Button>
        </div>
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
          blockedSlots={blockedSlots}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}

      <Card className="p-0 overflow-hidden printable">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <th className="py-3 px-5 font-medium text-gray-500">#</th>
              <th className="font-medium text-gray-500">Client</th>
              <th className="font-medium text-gray-500">Serviciu</th>
              <th className="font-medium text-gray-500">Data</th>
              {category === 'SALON' ? (
                <th className="font-medium text-gray-500">Telefon</th>
              ) : (
                <>
                  <th className="font-medium text-gray-500">Sală</th>
                  <th className="font-medium text-gray-500">Telefon</th>
                </>
              )}
              <th className="font-medium text-gray-500">Canal</th>
              <th className="font-medium text-gray-500">Status</th>
              <th className="font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {groupByWeek(bookings).map((group) => (
              <Fragment key={`week-${group.year}-${group.week}`}>
                <tr key={`week-${group.week}-${group.year}`} className="bg-[var(--surface-muted)]">
                  <td colSpan={category === "SALON" ? 8 : 9} className="px-5 py-2 text-xs font-semibold text-gray-500">
                    Săptămâna {group.week} · {group.rangeLabel} ({group.bookings.length} programări)
                  </td>
                </tr>
                {group.bookings.map((b) => (
                  <tr key={b.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]">
                    <td className="py-3 px-5 text-gray-400 font-mono text-xs">
                      {b.sequenceNumber ? `#${String(b.sequenceNumber).padStart(3, '0')}` : '—'}
                    </td>
                    <td className="font-medium">{b.customerName}</td>
                    <td>{b.serviceName}</td>
                    <td className="text-gray-500">{new Date(b.startAt).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bucharest' })}</td>
                    {category === 'SALON' ? (
                      <td className="text-gray-500">{b.customerPhone}</td>
                    ) : (
                      <>
                        <td className="text-gray-500">{b.resourceName ?? '—'}</td>
                        <td className="text-gray-500">{b.customerPhone}</td>
                      </>
                    )}
                    <td className="text-gray-500">{CHANNEL_LABEL[b.channel] ?? b.channel}</td>
                    <td>
                      <select
                        value={b.status}
                        onChange={(e) => changeStatus(b.id, e.target.value)}
                        className="text-xs py-1 px-2 rounded-full font-medium border-0"
                        style={{ backgroundColor: `${STATUS_COLOR[b.status]}20`, color: STATUS_COLOR[b.status] }}
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
              </Fragment>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={category === "SALON" ? 8 : 9} className="text-center text-gray-500 py-8">
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

function getISOWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function groupByWeek(bookings: Booking[]) {
  const groups = new Map<string, { week: number; year: number; bookings: Booking[]; weekStart: Date; weekEnd: Date }>()

  for (const b of bookings) {
    const date = new Date(b.startAt)
    const week = getISOWeekNumber(date)
    const year = date.getFullYear()
    const key = `${year}-${week}`

    if (!groups.has(key)) {
      const weekStart = new Date(date)
      const dayOfWeek = (weekStart.getDay() + 6) % 7 // luni = 0
      weekStart.setDate(weekStart.getDate() - dayOfWeek)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      groups.set(key, { week, year, bookings: [], weekStart, weekEnd })
    }
    groups.get(key)!.bookings.push(b)
  }

  return Array.from(groups.values())
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
    .map((g) => ({
      ...g,
      rangeLabel: `${g.weekStart.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', timeZone: 'Europe/Bucharest' })} – ${g.weekEnd.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', timeZone: 'Europe/Bucharest' })}`,
    }))
}

function NewBookingForm({
  customers,
  services,
  blockedSlots,
  onDone,
}: {
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  blockedSlots: { startAt: string; endAt: string }[]
  onDone: () => void
}) {
  const [customerId, setCustomerId] = useState('')
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const hasCustomer = newCustomerMode ? newCustomerName.trim() && newCustomerPhone.trim().length >= 6 : !!customerId

    if (!hasCustomer || !serviceId || !date) {
      setError(
        newCustomerMode
          ? 'Completează numele, telefonul, serviciul și data.'
          : 'Completează client, serviciu și dată.'
      )
      return
    }

    const service = services.find((s) => s.id === serviceId)
    const start = new Date(date)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    if (start < new Date()) {
      setError('Nu poți crea o rezervare într-un interval din trecut.')
      return
    }

    const overlapsBlocked = blockedSlots.some((b) => start < new Date(b.endAt) && new Date(b.startAt) < end)
    if (overlapsBlocked) {
      setError('Intervalul ales e blocat pentru rezervări — modifică-l direct din calendar dacă e nevoie.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetchWithTimeout('/api/business/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(newCustomerMode
            ? { customerName: newCustomerName.trim(), customerPhone: newCustomerPhone.trim() }
            : { customerId }),
          serviceId,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'A apărut o eroare. Verifică datele.')
        return
      }

      onDone()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-500">Client</label>
            <button
              type="button"
              onClick={() => setNewCustomerMode((v) => !v)}
              className="text-xs text-[var(--accent)] font-medium"
            >
              {newCustomerMode ? '← Alege client existent' : '+ Client nou'}
            </button>
          </div>
          {newCustomerMode ? (
            <div className="flex flex-col gap-2">
              <Input placeholder="Nume client" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              <Input
                placeholder="Telefon"
                type="tel"
                inputMode="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
            </div>
          ) : (
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full">
              <option value="">Alege client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
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

      <div className="mb-3 max-w-xs">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Data și ora</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            className="input-field w-full"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <Button variant="secondary" onClick={submit} disabled={saving}>
        {saving ? 'Se salvează...' : 'Salvează programarea'}
      </Button>
    </Card>
  )
}
