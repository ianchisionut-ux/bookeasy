'use client'

import { useState, useCallback, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import BookingEditModal, { BookingDetail } from '@/components/booking-edit-modal'
import { Lock, CheckCircle2, X } from 'lucide-react'
import { PrintButton } from '@/components/print-button'

const locales = { ro }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ro }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(Calendar) as any

function getISOWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

type Event = {
  id: string
  title: string
  start: Date
  end: Date
  status: string
  customerId: string
  customerName: string
  customerPhone: string
  confirmationRequestSent?: boolean
  customerConfirmed?: boolean | null
  serviceName: string
  practitionerId?: string | null
  practitionerName?: string | null
  isBlocked?: false
}

type BlockedEvent = {
  id: string
  title: string
  start: Date
  end: Date
  isBlocked: true
}

type BlockedSlot = { id: string; startAt: string; endAt: string; reason: string | null }

export default function CalendarClient({
  category,
  events,
  blockedSlots,
  minTime,
  maxTime,
  practitioners,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  events: Event[]
  blockedSlots: BlockedSlot[]
  minTime: string
  maxTime: string
  practitioners: { id: string; name: string; minTime: string; maxTime: string }[]
}) {
  const isClinic = category === 'CLINICA'
  const router = useRouter()
  const [selected, setSelected] = useState<Event | null>(null)
  const [view, setView] = useState<any>(Views.WEEK)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [busy, setBusy] = useState(false)
  const [practitionerFilter, setPractitionerFilter] = useState<string>(practitioners[0]?.id ?? '')

  const visibleEvents = practitioners.length === 0 ? events : events.filter((e) => e.practitionerId === practitionerFilter)
  const [blockMode, setBlockMode] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setView(Views.DAY)
    }
  }, [])

  const blockedEvents: BlockedEvent[] = blockedSlots.map((b) => ({
    id: b.id,
    title: b.reason ? `Blocat — ${b.reason}` : 'Blocat',
    start: new Date(b.startAt),
    end: new Date(b.endAt),
    isBlocked: true,
  }))

  const allEvents = [...visibleEvents, ...blockedEvents]

  function timeToDate(time: string) {
    const [h, m] = time.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  const selectedPractitioner = practitioners.find((p) => p.id === practitionerFilter) ?? null
  const effectiveMinTime = selectedPractitioner?.minTime ?? minTime
  const effectiveMaxTime = selectedPractitioner?.maxTime ?? maxTime
  const calendarMin = timeToDate(effectiveMinTime)
  const calendarMax = timeToDate(effectiveMaxTime)

  const blockRange = useCallback(
    async (start: Date, end: Date) => {
      const reason = prompt('Blochezi acest interval. Vrei să adaugi un motiv? (opțional, lasă gol dacă nu)')
      if (reason === null) return

      setBusy(true)
      try {
        const res = await fetchWithTimeout('/api/business/blocked-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startAt: start.toISOString(), endAt: end.toISOString(), reason: reason || undefined }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          alert(data.error ?? 'Nu am putut bloca intervalul.')
          return
        }
        router.refresh()
      } catch {
        alert('Conexiune eșuată. Încearcă din nou.')
      } finally {
        setBusy(false)
      }
    },
    [router]
  )

  const unblockSlot = useCallback(
    async (id: string) => {
      const confirmed = confirm('Deblochezi acest interval?')
      if (!confirmed) return
      setBusy(true)
      try {
        await fetchWithTimeout(`/api/business/blocked-slots/${id}`, { method: 'DELETE' })
        router.refresh()
      } catch {
        alert('Conexiune eșuată. Încearcă din nou.')
      } finally {
        setBusy(false)
      }
    },
    [router]
  )

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date; end: Date }) => {
      if (!blockMode) return
      blockRange(slotInfo.start, slotInfo.end)
    },
    [blockRange, blockMode]
  )

  const handleSelectEvent = useCallback(
    (event: Event | BlockedEvent) => {
      if ('isBlocked' in event && event.isBlocked) {
        if (blockMode) unblockSlot(event.id)
        return
      }
      setSelected(event as Event)
    },
    [unblockSlot, blockMode]
  )

  const moveOrResize = useCallback(
    async ({ event, start, end }: any) => {
      if (event.isBlocked) return

      const oldTime = new Date(event.start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bucharest' })
      const newTime = new Date(start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bucharest' })
      const confirmed = confirm(
        `Muți programarea "${event.customerName} — ${event.serviceName}" din ${oldTime} în ${newTime}?`
      )
      if (!confirmed) return

      try {
        const res = await fetchWithTimeout(`/api/business/bookings/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startAt: new Date(start).toISOString(),
            endAt: new Date(end).toISOString(),
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          alert(data.error ?? `Nu am putut muta ${isClinic ? 'programarea' : 'rezervarea'}.`)
          return
        }
        router.refresh()
      } catch {
        alert('Conexiune eșuată. Încearcă din nou.')
      }
    },
    [router]
  )

  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-40px)] p-4 lg:p-8 flex flex-col">
      <div className="mb-3 screen-only">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl lg:text-2xl font-semibold mr-1">{isClinic ? 'Calendar programări' : 'Calendar rezervări'}</h1>
          {practitioners.length > 0 && (
            <select
              value={practitionerFilter}
              onChange={(e) => setPractitionerFilter(e.target.value)}
              className="input-field text-sm py-1.5"
              aria-label="Filtrează după persoană"
            >
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setBlockMode((v) => !v)}
            className="btn-secondary text-sm whitespace-nowrap flex items-center gap-1.5"
            style={blockMode ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}
          >
            {blockMode ? (
              <>
                <CheckCircle2 size={15} /> Blocare activă
              </>
            ) : (
              <>
                <Lock size={15} /> Blocare poziții
              </>
            )}
          </button>
          <input
            type="date"
            value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`}
            onChange={(e) => {
              if (!e.target.value) return
              const [y, m, d] = e.target.value.split('-').map(Number)
              setCurrentDate(new Date(y, m - 1, d))
            }}
            className="input-field text-sm py-1.5 hidden lg:block"
            aria-label="Sari la o dată"
          />
          <PrintButton />
          <button onClick={() => setShowBookingModal(true)} className="btn-primary text-sm whitespace-nowrap">
            + Adaugă programare
          </button>
          {busy && <span className="text-xs text-gray-400">se actualizează...</span>}
        </div>
        {blockMode && (
          <p className="text-xs text-gray-500 mt-2">
            Selectează cu mouse-ul un interval ca să-l blochezi — click pe o zonă blocată pentru a o debloca
          </p>
        )}
      </div>
      <div className="card printable p-2 lg:p-4 flex-1 min-h-0 overflow-x-auto">
        <DnDCalendar
          key={practitionerFilter}
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          culture="ro"
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          min={calendarMin}
          max={calendarMax}
          messages={{
            today: 'Azi',
            previous: '<',
            next: '>',
            month: 'Lună',
            week: 'Săptămână',
            day: 'Zi',
            agenda: 'Agendă',
            date: 'Dată',
            time: 'Oră',
            event: 'Eveniment',
            noEventsInRange: isClinic ? 'Nicio programare în acest interval.' : 'Nicio rezervare în acest interval.',
            showMore: (count: number) => `+${count} mai multe`,
          }}
          formats={{
            dayRangeHeaderFormat: ({ start, end }: any) =>
              `Săpt. ${getISOWeekNumber(start)} · ${format(start, 'd MMM', { locale: ro })} – ${format(end, 'd MMM', { locale: ro })}`,
          }}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={moveOrResize}
          resizable={false}
          draggableAccessor={(event: any) => !event.isBlocked}
          eventPropGetter={(event: any) => {
            if (event.isBlocked) {
              return {
                style: {
                  background: 'repeating-linear-gradient(45deg, #d1d5db, #d1d5db 6px, #e5e7eb 6px, #e5e7eb 12px)',
                  border: '1px solid #9ca3af',
                  color: '#4b5563',
                  cursor: 'pointer',
                },
              }
            }
            return {
              style: {
                backgroundColor:
                  event.status === 'CONFIRMED' ? '#16a34a' : event.status === 'PENDING' ? '#eab308' : '#ef4444',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
              },
            }
          }}
          style={{ height: '100%' }}
        />
      </div>

      {selected && (
        <BookingEditModal
          isClinic={isClinic}
          booking={
            {
              id: selected.id,
              customerId: selected.customerId,
              customerName: selected.customerName,
              customerPhone: selected.customerPhone,
              serviceName: selected.serviceName,
              practitionerName: selected.practitionerName,
              confirmationRequestSent: selected.confirmationRequestSent,
              customerConfirmed: selected.customerConfirmed,
              startAt: selected.start.toISOString(),
              endAt: selected.end.toISOString(),
              status: selected.status as BookingDetail['status'],
            } as BookingDetail
          }
          onClose={() => setSelected(null)}
        />
      )}

      {showBookingModal && (
        <CalendarQuickBookingModal
          onClose={() => setShowBookingModal(false)}
          onCreated={() => {
            setShowBookingModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function CalendarQuickBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [services, setServices] = useState<{ id: string; name: string; durationMin: number | null }[]>([])
  const [practitioners, setPractitioners] = useState<{ id: string; name: string }[]>([])
  const [isMultiPractitioner, setIsMultiPractitioner] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [simpleDateTime, setSimpleDateTime] = useState('')
  const [daySlots, setDaySlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWithTimeout('/api/business/conversations/quick-booking-data')
      .then((res) => res.json())
      .then((data) => {
        setServices(data.services ?? [])
        setPractitioners(data.practitioners ?? [])
        setIsMultiPractitioner(!!data.isMultiPractitioner)
        if (data.practitioners?.length === 1) setPractitionerId(data.practitioners[0].id)
      })
      .catch(() => setError('Nu am putut încărca serviciile.'))
      .finally(() => setLoadingData(false))
  }, [])

  useEffect(() => {
    if (!isMultiPractitioner || !serviceId || !practitionerId || !slotDate) {
      setDaySlots([])
      return
    }
    setLoadingSlots(true)
    setSelectedSlot('')
    fetchWithTimeout(`/api/business/practitioner-availability?serviceId=${serviceId}&practitionerId=${practitionerId}&date=${slotDate}`)
      .then((res) => res.json())
      .then((data) => setDaySlots(data.allSlots ?? []))
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [isMultiPractitioner, serviceId, practitionerId, slotDate])

  async function submit() {
    const hasDateInfo = isMultiPractitioner ? !!selectedSlot : !!simpleDateTime
    if (!customerName.trim() || customerPhone.trim().length < 6 || !serviceId || !hasDateInfo) {
      setError('Completează numele, telefonul, serviciul și data.')
      return
    }
    if (isMultiPractitioner && !practitionerId) {
      setError('Alege persoana.')
      return
    }

    const service = services.find((s) => s.id === serviceId)
    const start = isMultiPractitioner ? new Date(selectedSlot) : new Date(simpleDateTime)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    if (start < new Date()) {
      setError('Nu poți crea o programare într-un interval din trecut.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/business/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
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
      onCreated()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Programare nouă</h2>
          <button onClick={onClose} aria-label="Închide">
            <X size={18} />
          </button>
        </div>

        {loadingData ? (
          <p className="text-sm text-gray-400">Se încarcă...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nume client" className="input-field" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Telefon" className="input-field" />
            </div>

            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input-field w-full">
              <option value="">Alege serviciul</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {isMultiPractitioner ? (
              <>
                {practitioners.length > 1 && (
                  <select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} className="input-field w-full">
                    <option value="">Alege persoana</option>
                    {practitioners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="input-field w-full" />
                {practitionerId && serviceId && (
                  <div>
                    {loadingSlots ? (
                      <p className="text-sm text-gray-400">Se încarcă orele...</p>
                    ) : daySlots.length === 0 ? (
                      <p className="text-sm text-gray-500">Niciun program pentru această zi.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {daySlots.map((slot) => {
                          const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
                          if (!slot.available) {
                            return (
                              <span key={slot.time} className="py-2 rounded-lg text-center text-sm text-gray-300 border border-[var(--border-soft)] line-through">
                                {time}
                              </span>
                            )
                          }
                          const active = selectedSlot === slot.time
                          return (
                            <button
                              key={slot.time}
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
              </>
            ) : (
              <input type="datetime-local" value={simpleDateTime} onChange={(e) => setSimpleDateTime(e.target.value)} className="input-field w-full" />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button onClick={submit} disabled={saving} className="btn-primary w-full">
              {saving ? 'Se salvează...' : 'Salvează programarea'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
