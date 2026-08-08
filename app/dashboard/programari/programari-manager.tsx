'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import { PrintButton } from '@/components/print-button'
import { CheckCircle2, Clock } from 'lucide-react'

type Booking = {
  id: string
  sequenceNumber: number | null
  customerName: string
  customerPhone: string
  customerId: string
  serviceName: string
  serviceId: string
  resourceName: string | null
  practitionerName: string | null
  startAt: string
  endAt: string
  status: string
  channel: string
  confirmationRequestSent: boolean
  customerConfirmed: boolean | null
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

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#16a34a',
  PENDING: '#eab308',
  CANCELLED: '#ef4444',
  COMPLETED: '#6b7280',
  NO_SHOW: '#ef4444',
}

// Saloanele și clinicile au servicii cu durată fixă (Telefon), spațiile de evenimente
// au săli/resurse (Sală) — dimensiune independentă de teamSize
function isAppointmentBased(category: string) {
  return category === 'SALON' || category === 'CLINICA'
}

export default function ProgramariManager({
  category,
  isMultiPractitioner,
  bookings,
  customers,
  services,
  blockedSlots,
  practitioners,
  filters,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  isMultiPractitioner: boolean
  bookings: Booking[]
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  blockedSlots: { startAt: string; endAt: string }[]
  practitioners: { id: string; name: string }[]
  filters: { status: string; q: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [adding, setAdding] = useState(searchParams.get('add') === '1')
  const isClinic = category === 'CLINICA'
  const appointmentBased = isAppointmentBased(category)
  // 8 coloane (fără Sală/Medic) sau 9 (cu Sală sau Medic)
  const colCount = appointmentBased && !isMultiPractitioner ? 8 : 9

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
          category={category}
          isMultiPractitioner={isMultiPractitioner}
          customers={customers}
          services={services}
          blockedSlots={blockedSlots}
          practitioners={practitioners}
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
              <th className="font-medium text-gray-500">{isClinic ? 'Pacient' : 'Client'}</th>
              <th className="font-medium text-gray-500">Serviciu</th>
              <th className="font-medium text-gray-500">Data</th>
              {isMultiPractitioner ? (
                <>
                  <th className="font-medium text-gray-500">Medic</th>
                  <th className="font-medium text-gray-500">Telefon</th>
                </>
              ) : appointmentBased ? (
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
                  <td colSpan={colCount} className="px-5 py-2 text-xs font-semibold text-gray-500">
                    Săptămâna {group.week} · {group.rangeLabel} ({group.bookings.length} programări)
                  </td>
                </tr>
                {group.bookings.map((b) => (
                  <tr key={b.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]">
                    <td className="py-3 px-5 text-gray-400 font-mono text-xs">
                      {b.sequenceNumber ? `#${String(b.sequenceNumber).padStart(3, '0')}` : '—'}
                    </td>
                    <td className="font-medium">
                      <a href={`/dashboard/clienti/${b.customerId}`} className="text-[var(--accent)] hover:underline">
                        {b.customerName}
                      </a>
                    </td>
                    <td>{b.serviceName}</td>
                    <td className="text-gray-500">{new Date(b.startAt).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bucharest' })}</td>
                    {isMultiPractitioner ? (
                      <>
                        <td className="text-gray-500">{b.practitionerName ?? '—'}</td>
                        <td className="text-gray-500">{b.customerPhone}</td>
                      </>
                    ) : appointmentBased ? (
                      <td className="text-gray-500">{b.customerPhone}</td>
                    ) : (
                      <>
                        <td className="text-gray-500">{b.resourceName ?? '—'}</td>
                        <td className="text-gray-500">{b.customerPhone}</td>
                      </>
                    )}
                    <td className="text-gray-500">{CHANNEL_LABEL[b.channel] ?? b.channel}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
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
                        {b.confirmationRequestSent && b.status === 'CONFIRMED' && (
                          <span title={b.customerConfirmed ? 'Confirmată de client' : 'Așteaptă confirmare de la client'}>
                            {b.customerConfirmed ? (
                              <CheckCircle2 size={13} color="#16a34a" />
                            ) : (
                              <Clock size={13} color="#eab308" />
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="pr-5 text-right">
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
                <td colSpan={colCount} className="text-center text-gray-500 py-8">
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

function groupByWeek(bookings: Booking[]) {
  const groups = new Map<string, { year: number; week: number; bookings: Booking[] }>()
  for (const b of bookings) {
    const d = new Date(b.startAt)
    const week = getISOWeekNumber(d)
    const year = d.getFullYear()
    const key = `${year}-${week}`
    if (!groups.has(key)) groups.set(key, { year, week, bookings: [] })
    groups.get(key)!.bookings.push(b)
  }
  return Array.from(groups.values())
    .sort((a, b) => (b.year - a.year) || (b.week - a.week))
    .map((g) => ({ ...g, rangeLabel: weekRangeLabel(g.bookings) }))
}

function getISOWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function weekRangeLabel(bookings: Booking[]) {
  const dates = bookings.map((b) => new Date(b.startAt).getTime())
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  const fmt = (d: Date) => d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', timeZone: 'Europe/Bucharest' })
  return `${fmt(min)} – ${fmt(max)}`
}

function NewBookingForm({
  category,
  isMultiPractitioner,
  customers,
  services,
  blockedSlots,
  practitioners,
  onDone,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  isMultiPractitioner: boolean
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  blockedSlots: { startAt: string; endAt: string }[]
  practitioners: { id: string; name: string }[]
  onDone: () => void
}) {
  const isClinic = category === 'CLINICA'
  const [customerId, setCustomerId] = useState('')
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [practitionerId, setPractitionerId] = useState(practitioners.length === 1 ? practitioners[0].id : '')
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [daySlots, setDaySlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isMultiPractitioner || !serviceId || !practitionerId || !slotDate) {
      setDaySlots([])
      return
    }
    setLoadingSlots(true)
    setSelectedSlot('')
    fetchWithTimeout(
      `/api/business/practitioner-availability?serviceId=${serviceId}&practitionerId=${practitionerId}&date=${slotDate}`
    )
      .then((res) => res.json())
      .then((data) => setDaySlots(data.allSlots ?? []))
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [isMultiPractitioner, serviceId, practitionerId, slotDate])

  async function submit() {
    const hasCustomer = newCustomerMode ? newCustomerName.trim() && newCustomerPhone.trim().length >= 6 : !!customerId
    const hasDateInfo = isMultiPractitioner ? !!selectedSlot : !!date

    if (!hasCustomer || !serviceId || !hasDateInfo) {
      setError(
        newCustomerMode
          ? 'Completează numele, telefonul, serviciul și data.'
          : isMultiPractitioner
            ? `Completează ${isClinic ? 'pacient' : 'client'}, serviciu, persoană și oră.`
            : `Completează ${isClinic ? 'pacient' : 'client'}, serviciu și dată.`
      )
      return
    }
    if (isMultiPractitioner && !practitionerId) {
      setError('Alege persoana.')
      return
    }

    const service = services.find((s) => s.id === serviceId)
    const start = isMultiPractitioner ? new Date(selectedSlot) : new Date(date)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    if (start < new Date()) {
      setError('Nu poți crea o rezervare într-un interval din trecut.')
      return
    }

    if (!isMultiPractitioner) {
      const overlapsBlocked = blockedSlots.some((b) => start < new Date(b.endAt) && new Date(b.startAt) < end)
      if (overlapsBlocked) {
        setError('Intervalul ales e blocat pentru rezervări — modifică-l direct din calendar dacă e nevoie.')
        return
      }
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
          practitionerId: isMultiPractitioner ? practitionerId : undefined,
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
            <label className="text-sm text-gray-500">{isClinic ? 'Pacient' : 'Client'}</label>
            <button
              type="button"
              onClick={() => setNewCustomerMode((v) => !v)}
              className="text-xs text-[var(--accent)] font-medium"
            >
              {newCustomerMode ? `← Alege ${isClinic ? 'pacient' : 'client'} existent` : `+ ${isClinic ? 'Pacient' : 'Client'} nou`}
            </button>
          </div>
          {newCustomerMode ? (
            <div className="flex flex-col gap-2">
              <Input placeholder={isClinic ? 'Nume pacient' : 'Nume client'} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
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
              <option value="">{isClinic ? 'Alege pacient' : 'Alege client'}</option>
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

      {isMultiPractitioner ? (
        <div className="mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {practitioners.length > 1 && (
              <div>
                <label className="text-sm text-gray-500 block mb-1.5">Persoana</label>
                <select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} className="input-field w-full">
                  <option value="">Alege persoana</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {practitioners.length === 0 && (
              <p className="text-sm text-amber-600 sm:col-span-2">
                Nicio persoană activă — adaugă una din <a href="/dashboard/medici" className="underline">Medici</a> ca să poți programa.
              </p>
            )}
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Data</label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                min={(() => {
                  const d = new Date()
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                })()}
                className="input-field w-full"
              />
            </div>
          </div>

          {practitionerId && serviceId && (
            <div>
              <label className="text-sm text-gray-500 block mb-2">
                Oră disponibilă {services.find((s) => s.id === serviceId)?.durationMin ? `(pas de ${services.find((s) => s.id === serviceId)?.durationMin} min, după durata serviciului)` : ''}
              </label>
              {loadingSlots ? (
                <p className="text-sm text-gray-400">Se încarcă orele...</p>
              ) : daySlots.length === 0 ? (
                <p className="text-sm text-gray-500">Niciun program setat pentru această persoană în ziua aleasă.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {daySlots.map((slot) => {
                    const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
                    if (!slot.available) {
                      return (
                        <span key={slot.time} className="py-2 rounded-lg text-center text-sm text-gray-300 border border-[var(--border-soft)] line-through select-none">
                          {time}
                        </span>
                      )
                    }
                    const active = selectedSlot === slot.time
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setSelectedSlot(slot.time)}
                        className="py-2 rounded-lg text-center text-sm font-medium border transition"
                        style={active ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
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
      )}

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <Button variant="secondary" onClick={submit} disabled={saving}>
        {saving ? 'Se salvează...' : 'Salvează programarea'}
      </Button>
    </Card>
  )
}
