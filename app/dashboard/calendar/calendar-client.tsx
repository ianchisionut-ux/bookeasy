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
  events,
  blockedSlots,
  minTime,
  maxTime,
  practitioners,
}: {
  events: Event[]
  blockedSlots: BlockedSlot[]
  minTime: string
  maxTime: string
  practitioners: { id: string; name: string; minTime: string; maxTime: string }[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Event | null>(null)
  const [view, setView] = useState<any>(Views.WEEK)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [busy, setBusy] = useState(false)
  const [practitionerFilter, setPractitionerFilter] = useState<string>('ALL')

  const visibleEvents = practitionerFilter === 'ALL' ? events : events.filter((e) => e.practitionerId === practitionerFilter)
  const [blockMode, setBlockMode] = useState(false)

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

  // când e ales un medic anume, calendarul arată intervalul orar al programului LUI,
  // nu programul general al businessului — fiecare medic își vede propriile ore
  const selectedPractitioner = practitionerFilter !== 'ALL' ? practitioners.find((p) => p.id === practitionerFilter) : null
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
          alert(data.error ?? 'Nu am putut muta rezervarea.')
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
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-semibold">Calendar rezervări</h1>
            {practitioners.length > 0 && (
              <select
                value={practitionerFilter}
                onChange={(e) => setPractitionerFilter(e.target.value)}
                className="input-field text-sm py-1.5"
                aria-label="Filtrează după medic"
              >
                <option value="ALL">Toți medicii</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {blockMode
            ? 'Selectează cu mouse-ul un interval ca să-l blochezi — click pe o zonă blocată pentru a o debloca'
            : 'Click pe o rezervare pentru detalii/editare'}
          {busy && <span className="text-gray-400"> · se actualizează...</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setBlockMode((v) => !v)}
            className="btn-secondary text-sm whitespace-nowrap"
            style={blockMode ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}
          >
            {blockMode ? '✓ Blocare activă — apasă ca să ieși' : '🔒 Blocare/Rezervare poziții'}
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
        </div>
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
            noEventsInRange: 'Nicio rezervare în acest interval.',
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
          booking={
            {
              id: selected.id,
              customerId: selected.customerId,
              customerName: selected.customerName,
              customerPhone: selected.customerPhone,
              serviceName: selected.serviceName,
              practitionerName: selected.practitionerName,
              startAt: selected.start.toISOString(),
              endAt: selected.end.toISOString(),
              status: selected.status as BookingDetail['status'],
            } as BookingDetail
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
