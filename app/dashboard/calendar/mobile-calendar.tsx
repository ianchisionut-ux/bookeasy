import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { CalendarClock, ChevronLeft, ChevronRight, Clock3, Lock, Plus, SlidersHorizontal } from 'lucide-react'
import { PrintButton } from '@/components/print-button'
import type { BlockedEvent, BreakEvent, Event } from './calendar-client'
import './mobile-calendar.css'

const weekdays = [
  ['L', 'Luni'], ['M', 'Marți'], ['M', 'Miercuri'], ['J', 'Joi'],
  ['V', 'Vineri'], ['S', 'Sâmbătă'], ['D', 'Duminică'],
]

const statusLabels: Record<string, string> = {
  PENDING: 'În așteptare',
  CONFIRMED: 'Confirmată',
  COMPLETED: 'Finalizată',
  NO_SHOW: 'Neprezentare',
  CANCELLED: 'Anulată',
}

type CalendarEvent = Event | BlockedEvent | BreakEvent

type Props = {
  date: Date
  today: Date
  events: Event[]
  blockedEvents: BlockedEvent[]
  breaks: BreakEvent[]
  serviceColors: ReadonlyMap<string, { ink: string; border: string }>
  bookingSingular: string
  bookingPlural: string
  loading: boolean
  hasFilters: boolean
  filters: ReactNode
  onSelectDate: (date: Date) => void
  onChangeMonth: (direction: number) => void
  onSelectBooking: (event: Event) => void
  onUnblock: (id: string) => void
  onAddBooking: () => void
  onOpenTimeline: (blocking: boolean) => void
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function nextDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
}

function bookingColor(event: Event, colors: Props['serviceColors']) {
  if (event.status === 'NO_SHOW' || event.status === 'CANCELLED') return '#7a8790'
  return colors.get(event.serviceId)?.border ?? '#148783'
}

function agendaTime(time: Date, date: Date) {
  return format(time, +dayStart(time) === +dayStart(date) ? 'HH:mm' : 'd MMM HH:mm', { locale: ro })
}

export default function MobileCalendar({
  date, today, events, blockedEvents, breaks, serviceColors, bookingSingular, bookingPlural, loading,
  hasFilters, filters, onSelectDate, onChangeMonth, onSelectBooking, onUnblock, onAddBooking, onOpenTimeline,
}: Props) {
  const [showOptions, setShowOptions] = useState(false)
  const year = date.getFullYear()
  const month = date.getMonth()
  const selectedDay = +dayStart(date)
  const todayDay = +dayStart(today)

  const monthDays = useMemo(() => {
    const first = new Date(year, month, 1)
    const offset = (first.getDay() + 6) % 7
    const count = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1
      return day >= 1 && day <= count ? new Date(year, month, day) : null
    })
  }, [year, month])

  const bookingsByDay = useMemo(() => {
    const first = new Date(year, month, 1)
    const end = new Date(year, month + 1, 1)
    const result = new Map<number, Event[]>()
    for (const event of events) {
      if (event.end <= first || event.start >= end) continue
      for (let day = event.start < first ? first : dayStart(event.start); day < end && day < event.end; day = nextDay(day)) {
        const items = result.get(+day)
        if (items) items.push(event)
        else result.set(+day, [event])
      }
    }
    return result
  }, [events, year, month])

  const selectedBookings = bookingsByDay.get(selectedDay) ?? []
  const endOfSelectedDay = nextDay(date)
  const agenda: CalendarEvent[] = [
    ...selectedBookings,
    ...[...blockedEvents, ...breaks].filter((event) => event.start < endOfSelectedDay && +event.end > selectedDay),
  ].sort((a, b) => +a.start - +b.start || +a.end - +b.end)

  return (
    <div className="calendar-mobile card printable">
      <div className="calendar-mobile-month screen-only">
        <div className="calendar-mobile-heading">
          <button type="button" className="calendar-mobile-icon" onClick={() => onChangeMonth(-1)} aria-label="Luna anterioară">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h1 aria-live="polite">{format(date, 'LLLL', { locale: ro })} <span>{year}</span></h1>
          <button type="button" className="calendar-mobile-icon" onClick={() => onChangeMonth(1)} aria-label="Luna următoare">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="calendar-mobile-weekdays" aria-hidden="true">
          {weekdays.map(([short, full]) => <span key={full} title={full}>{short}</span>)}
        </div>
        <div className="calendar-mobile-grid" role="group" aria-label="Zilele lunii">
          {monthDays.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} className="calendar-mobile-empty-cell" aria-hidden="true" />
            const bookings = bookingsByDay.get(+day) ?? []
            const colors = [...new Set(bookings.map((event) => bookingColor(event, serviceColors)))].slice(0, 3)
            const label = bookings.length === 1 ? bookingSingular : bookingPlural
            const selected = +day === selectedDay
            return (
              <button
                key={+day} type="button" className="calendar-mobile-day"
                aria-label={`${format(day, 'EEEE d MMMM yyyy', { locale: ro })}${bookings.length ? `, ${bookings.length} ${label}` : ''}`}
                aria-pressed={selected} aria-current={+day === todayDay ? 'date' : undefined}
                onClick={() => onSelectDate(day)}
              >
                <span className="calendar-mobile-day-number">{day.getDate()}</span>
                <span className="calendar-mobile-markers" aria-hidden="true">
                  {colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="calendar-mobile-agenda" aria-labelledby="mobile-agenda-date">
        <div className="calendar-mobile-agenda-bar">
          <h2 id="mobile-agenda-date">{format(date, 'EEEE, d MMMM', { locale: ro })}</h2>
          <div className="calendar-mobile-actions-row screen-only">
            <button type="button" className="calendar-mobile-icon calendar-mobile-today"
              onClick={() => onSelectDate(today)} aria-label="Mergi la data de astăzi">Azi</button>
            <button type="button" className="calendar-mobile-icon calendar-mobile-options-trigger"
              aria-label={hasFilters ? 'Opțiuni calendar, filtre active' : 'Opțiuni calendar'}
              aria-expanded={showOptions} aria-controls="mobile-calendar-options" onClick={() => setShowOptions((shown) => !shown)}>
              <SlidersHorizontal size={18} aria-hidden="true" />
              {hasFilters && <span aria-hidden="true" />}
            </button>
            <button type="button" className="calendar-mobile-icon calendar-mobile-create"
              aria-label={`Adaugă ${bookingSingular}`} onClick={onAddBooking}><Plus size={23} aria-hidden="true" /></button>
          </div>
        </div>

        <div id="mobile-calendar-options" className="calendar-mobile-options screen-only" hidden={!showOptions}>
          <div className="calendar-mobile-fields">{filters}</div>
          <div className="calendar-mobile-management">
            <button type="button" className="btn-secondary" onClick={() => onOpenTimeline(false)}>
              <CalendarClock size={17} aria-hidden="true" /> Calendar pe ore
            </button>
            <button type="button" className="btn-secondary" onClick={() => onOpenTimeline(true)}>
              <Lock size={16} aria-hidden="true" /> Blochează intervale
            </button>
            <PrintButton />
          </div>
        </div>

        {loading && <p className="calendar-mobile-message screen-only" role="status">Se actualizează calendarul…</p>}
        {!loading && !agenda.length && (
          <p className="calendar-mobile-message">
            {hasFilters ? `Nicio ${bookingSingular} nu corespunde filtrelor pentru această zi.` : `Nicio ${bookingSingular} în această zi.`}
          </p>
        )}
        {!!agenda.length && <ul className="calendar-mobile-list">
          {agenda.map((event) => {
            const times = <span className="calendar-mobile-times">
              <time dateTime={event.start.toISOString()}>{agendaTime(event.start, date)}</time>
              <time dateTime={event.end.toISOString()}>{agendaTime(event.end, date)}</time>
            </span>
            if ('isBreak' in event) {
              return <li className="calendar-mobile-row" key={`break-${event.id}`}>
                <div className="calendar-mobile-entry calendar-mobile-muted-entry">
                  <span className="calendar-mobile-entry-icon"><Clock3 size={17} aria-hidden="true" /></span>
                  <span className="calendar-mobile-entry-content"><strong>{event.title}</strong></span>
                  {times}
                </div>
              </li>
            }
            if (event.isBlocked) {
              return <li className="calendar-mobile-row" key={`blocked-${event.id}`}>
                <button type="button" className="calendar-mobile-entry calendar-mobile-muted-entry"
                  aria-label={`Deblochează intervalul ${agendaTime(event.start, date)}–${agendaTime(event.end, date)}`}
                  onClick={() => onUnblock(event.id)}>
                  <span className="calendar-mobile-entry-icon"><Lock size={16} aria-hidden="true" /></span>
                  <span className="calendar-mobile-entry-content"><strong>{event.title}</strong></span>
                  {times}
                </button>
              </li>
            }
            const status = event.arrivedAt ? 'A ajuns' : statusLabels[event.status]
            return <li className="calendar-mobile-row" key={`booking-${event.id}`}>
              <button type="button" className="calendar-mobile-entry" onClick={() => onSelectBooking(event)}>
                <span className="calendar-mobile-entry-mark" style={{ backgroundColor: bookingColor(event, serviceColors) }} aria-hidden="true" />
                <span className="calendar-mobile-entry-content">
                  <strong>{event.serviceName}</strong>
                  <span>{event.customerName}{event.practitionerName ? ` · ${event.practitionerName}` : ''}</span>
                  {status && <span className={`calendar-mobile-status${event.arrivedAt ? ' calendar-mobile-arrived' : ''}`}>{status}</span>}
                </span>
                {times}
              </button>
            </li>
          })}
        </ul>}
      </section>
    </div>
  )
}
