'use client'

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import type { BookingDetail } from '@/components/booking-edit-modal'
import { useSmsAvailability } from '@/components/use-sms-availability'
import { Lock, X, Search, SlidersHorizontal, Users, AlertTriangle, Clock3, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import { PrintButton } from '@/components/print-button'
import { allPractitionersLabel, bookingTerminology, isAppointmentCategory, isPatientCategory, offerLabel, practitionerLabel, type BusinessCategory } from '@/lib/business-categories'

const locales = { ro }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ro }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(Calendar) as any
const BookingEditModal = dynamic(() => import('@/components/booking-edit-modal'), {
  loading: () => null,
})

const SERVICE_COLORS = [
  { background: '#e8fbef', border: '#22c55e', ink: '#14532d' },
  { background: '#e8f3ff', border: '#3b82f6', ink: '#1e3a8a' },
  { background: '#f4eaff', border: '#a855f7', ink: '#581c87' },
  { background: '#fff3da', border: '#f59e0b', ink: '#78350f' },
  { background: '#ffeaf2', border: '#ec4899', ink: '#831843' },
  { background: '#e4f9f8', border: '#14b8a6', ink: '#134e4a' },
]

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

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
  channel: string
  customerId: string
  customerName: string
  customerPhone: string
  customerCreatedAt?: string
  confirmationRequestSent?: boolean
  customerConfirmed?: boolean | null
  arrivedAt?: string | null
  serviceName: string
  serviceId: string
  resourceId?: string | null
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
type BreakEvent = { id: string; title: string; start: Date; end: Date; isBreak: true }
type BreakRange = { label: string; startTime: string; endTime: string }

export default function CalendarClient({
  initialSmsAvailable,
  category,
  services,
  resources,
  events,
  blockedSlots,
  minTime,
  maxTime,
  businessWorkingHours,
  businessBreaks,
  slotIntervalMinutes,
  practitioners,
}: {
  initialSmsAvailable: boolean
  category: BusinessCategory
  services: { id: string; name: string }[]
  resources: { id: string; name: string }[]
  events: Event[]
  blockedSlots: BlockedSlot[]
  minTime: string
  maxTime: string
  businessWorkingHours: { weekday: number; startTime: string; endTime: string }[]
  businessBreaks: BreakRange[]
  slotIntervalMinutes: number
  practitioners: { id: string; name: string; minTime: string; maxTime: string; workingHours: { weekday: number; startTime: string; endTime: string }[]; breaks: BreakRange[] }[]
}) {
  const isClinic = isPatientCategory(category)
  const smsAvailable = useSmsAvailability(initialSmsAvailable)
  const isAppointmentBased = isAppointmentCategory(category)
  const { singular: bookingSingular, plural: bookingPlural, heading: bookingHeading } = bookingTerminology(category)
  const customerPlural = isClinic ? 'pacienți' : 'clienți'
  const customerSingular = isClinic ? 'pacient' : 'client'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<Event | null>(null)
  const [view, setView] = useState<any>(Views.WEEK)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calendarEvents, setCalendarEvents] = useState<Event[]>(events)
  const [loadingRange, setLoadingRange] = useState(false)
  const [busy, setBusy] = useState(false)
  const [calendarRevision, setCalendarRevision] = useState(0)
  const [practitionerFilter, setPractitionerFilter] = useState<string>(() => {
    const requestedPractitioner = searchParams.get('medic')
    if (requestedPractitioner && practitioners.some((practitioner) => practitioner.id === requestedPractitioner)) {
      return requestedPractitioner
    }
    return practitioners.length > 1 ? 'all' : practitioners[0]?.id ?? ''
  })
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [hiddenPractitionerIds, setHiddenPractitionerIds] = useState<string[]>([])
  const [hiddenServiceIds, setHiddenServiceIds] = useState<string[]>([])

  useEffect(() => {
    setCalendarEvents((current) => {
      const merged = new Map(current.map((event) => [event.id, event]))
      events.forEach((event) => merged.set(event.id, event))
      return Array.from(merged.values())
    })
  }, [events])

  useEffect(() => {
    let active = true
    const refreshArrivals = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const response = await fetch('/api/business/bookings/arrivals', { cache: 'no-store' })
        if (!response.ok || !active) return
        const data = await response.json() as { arrivals?: { id: string; arrivedAt: string | null }[] }
        if (!active || !data.arrivals?.length) return
        const arrived = new Map(data.arrivals.map((item) => [item.id, item.arrivedAt]))
        setCalendarEvents((current) => {
          let changed = false
          const updated = current.map((event) => {
            const arrivedAt = arrived.get(event.id)
            if (!arrivedAt || event.arrivedAt === arrivedAt) return event
            changed = true
            return { ...event, arrivedAt }
          })
          return changed ? updated : current
        })
      } catch { /* reîncercăm la următoarea verificare */ }
    }
    void refreshArrivals()
    const timer = window.setInterval(() => void refreshArrivals(), 20_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const calendarYear = currentDate.getFullYear()
  const calendarMonth = currentDate.getMonth()
  useEffect(() => {
    const from = new Date(calendarYear, calendarMonth - 1, 1)
    const to = new Date(calendarYear, calendarMonth + 2, 1)
    const controller = new AbortController()
    setLoadingRange(true)
    fetchWithTimeout(`/api/business/bookings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('range request failed')
        const data = await response.json()
        const incoming: Event[] = (data.events ?? []).map((event: Event & { start: string; end: string }) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }))
        setCalendarEvents((current) => {
          const merged = new Map(current.map((event) => [event.id, event]))
          incoming.forEach((event) => merged.set(event.id, event))
          return Array.from(merged.values())
        })
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('[calendar] Nu am putut încărca intervalul:', error)
      })
      .finally(() => setLoadingRange(false))
    return () => controller.abort()
  }, [calendarYear, calendarMonth])

  function changePractitionerFilter(value: string) {
    setPractitionerFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') params.set('medic', value)
    else params.delete('medic')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const visibleEvents = useMemo(() => calendarEvents.filter((e) => {
    const practitionerMatch = practitioners.length === 0 || practitionerFilter === 'all' || e.practitionerId === practitionerFilter
    const practitionerVisible = !e.practitionerId || !hiddenPractitionerIds.includes(e.practitionerId)
    const serviceMatch = serviceFilter === 'all' || e.serviceId === serviceFilter
    const serviceVisible = !hiddenServiceIds.includes(e.serviceId)
    const resourceMatch = resourceFilter === 'all' || e.resourceId === resourceFilter
    const query = search.trim().toLocaleLowerCase('ro')
    const searchMatch = !query || `${e.customerName} ${e.customerPhone} ${e.serviceName} ${e.practitionerName ?? ''}`.toLocaleLowerCase('ro').includes(query)
    return practitionerMatch && practitionerVisible && serviceMatch && serviceVisible && resourceMatch && searchMatch
  }), [calendarEvents, practitionerFilter, practitioners.length, hiddenPractitionerIds, serviceFilter, hiddenServiceIds, resourceFilter, search])
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

  function timeToDate(time: string) {
    const [h, m] = time.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  const selectedPractitioner = practitioners.find((p) => p.id === practitionerFilter) ?? null
  const activeWorkingHours = useMemo(() => selectedPractitioner?.workingHours ?? (practitioners.length === 0 ? businessWorkingHours : []), [selectedPractitioner, practitioners.length, businessWorkingHours])
  const activeBreaks = useMemo(() => selectedPractitioner?.breaks ?? (practitioners.length === 0 ? businessBreaks : []), [selectedPractitioner, practitioners.length, businessBreaks])
  const breakEvents = useMemo<BreakEvent[]>(() => {
    if (activeBreaks.length === 0) return []
    const result: BreakEvent[] = []
    for (let offset = -45; offset <= 45; offset++) {
      const day = new Date(currentDate)
      day.setDate(day.getDate() + offset)
      if (!activeWorkingHours.some((range) => range.weekday === day.getDay())) continue
      for (const [index, pause] of activeBreaks.entries()) {
        const [startHour, startMinute] = pause.startTime.split(':').map(Number)
        const [endHour, endMinute] = pause.endTime.split(':').map(Number)
        const start = new Date(day); start.setHours(startHour, startMinute, 0, 0)
        const end = new Date(day); end.setHours(endHour, endMinute, 0, 0)
        result.push({ id: `break-${day.toISOString().slice(0, 10)}-${index}`, title: pause.label, start, end, isBreak: true })
      }
    }
    return result
  }, [activeBreaks, activeWorkingHours, currentDate])
  const allEvents = [...visibleEvents, ...blockedEvents]
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
      if (blockMode) blockRange(slotInfo.start, slotInfo.end)
    },
    [blockRange, blockMode]
  )

  const handleSelectEvent = useCallback(
    (event: Event | BlockedEvent | BreakEvent) => {
      if ('isBreak' in event && event.isBreak) return
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
      if (event.isBlocked || event.isBreak) return

      const resetPosition = () => setCalendarRevision((value) => value + 1)
      const eventPractitioner = practitioners.find((practitioner) => practitioner.id === event.practitionerId)
      const relevantBreaks = eventPractitioner?.breaks ?? activeBreaks
      const overlapsBreak = relevantBreaks.some((pause) => {
        const [startHour, startMinute] = pause.startTime.split(':').map(Number)
        const [endHour, endMinute] = pause.endTime.split(':').map(Number)
        const pauseStart = new Date(start); pauseStart.setHours(startHour, startMinute, 0, 0)
        const pauseEnd = new Date(start); pauseEnd.setHours(endHour, endMinute, 0, 0)
        return new Date(start) < pauseEnd && new Date(end) > pauseStart
      })
      if (overlapsBreak) {
        alert(`${bookingHeading} nu pot fi mutate peste o pauză.`)
        resetPosition()
        return
      }

      const conflict = calendarEvents.some((candidate) => candidate.id !== event.id && candidate.practitionerId === event.practitionerId && new Date(start) < candidate.end && new Date(end) > candidate.start)
      if (conflict) {
        alert(`Conflict detectat: ${category === 'EVENT_VENUE' ? 'sala' : practitionerLabel(category).definite} are deja o ${bookingSingular} în acest interval.`)
        resetPosition()
        return
      }

      const oldTime = new Date(event.start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', hour12: false, timeZone: 'Europe/Bucharest' })
      const newTime = new Date(start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', hour12: false, timeZone: 'Europe/Bucharest' })
      const confirmed = confirm(
        `Muți ${bookingSingular}a "${event.customerName} — ${event.serviceName}" din ${oldTime} în ${newTime}?`
      )
      if (!confirmed) {
        resetPosition()
        return
      }

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
          alert(data.error ?? `Nu am putut muta ${bookingSingular}a.`)
          resetPosition()
          return
        }
        router.refresh()
      } catch {
        alert('Conexiune eșuată. Încearcă din nou.')
        resetPosition()
      }
    },
    [router, calendarEvents, isClinic, bookingHeading, bookingSingular, practitioners, activeBreaks, category]
  )

  const today = new Date()
  const todayEvents = calendarEvents.filter((event) => sameDay(event.start, today))
  const newCustomersToday = new Set(todayEvents.filter((event) => event.customerCreatedAt && sameDay(new Date(event.customerCreatedAt), today)).map((event) => event.customerId)).size
  const pendingToday = todayEvents.filter((event) => event.status === 'PENDING').length
  const completedToday = todayEvents.filter((event) => event.status === 'COMPLETED').length
  const dateValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
  const weekStart = startOfWeek(currentDate, { locale: ro })
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
  const periodLabel = view === Views.MONTH
    ? format(currentDate, 'LLLL yyyy', { locale: ro })
    : view === Views.WEEK
      ? `Săpt. ${getISOWeekNumber(currentDate)} · ${format(weekStart, 'd MMM', { locale: ro })} – ${format(weekEnd, 'd MMM yyyy', { locale: ro })}`
      : format(currentDate, 'EEEE d MMMM yyyy', { locale: ro })

  function navigatePeriod(direction: number) {
    const next = new Date(currentDate)
    if (view === Views.MONTH) next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + direction * (view === Views.WEEK ? 7 : 1))
    setCurrentDate(next)
  }

  function chooseDate(value: string) {
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    setCurrentDate(new Date(year, month - 1, day))
  }

  return (
    <div className="calendar-page calendar-modern dashboard-page flex h-[calc(100dvh-138px)] min-h-[540px] flex-col gap-3 md:h-[calc(100vh-56px)] lg:h-screen">
      <header className="calendar-overview screen-only">
        <div className="calendar-overview-title">
          <h1>Calendar {bookingPlural}</h1>
          <p>Gestionează {bookingPlural}, {practitionerLabel(category).plural.toLowerCase()} și {resources.length ? 'sălile' : 'serviciile'} într-un singur loc.</p>
        </div>
        <div className="calendar-summary-grid">
          <CalendarSummary icon={<CalendarDays size={18}/>} value={todayEvents.length} label={`${bookingHeading} azi`} tone="teal" />
          <CalendarSummary icon={<Users size={18}/>} value={newCustomersToday} label={`${customerPlural[0].toUpperCase()}${customerPlural.slice(1)} noi`} tone="violet" />
          <CalendarSummary icon={<Clock3 size={18}/>} value={pendingToday} label="În așteptare" tone="amber" />
          <div className="hidden md:block"><CalendarSummary icon={<ClipboardCheck size={18}/>} value={completedToday} label="Finalizate azi" tone="green" /></div>
        </div>
      </header>

      <div className="calendar-commandbar calendar-modern-commandbar screen-only">
        <div className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowBookingModal(true)} className="btn-primary shrink-0 whitespace-nowrap">+ Adaugă {bookingSingular}</button>
          {practitioners.length > 0 && <select value={practitionerFilter} onChange={(e) => changePractitionerFilter(e.target.value)} className="input-field shrink-0 text-sm" aria-label="Filtrează după persoană">
            <option value="all">{allPractitionersLabel(category)}</option>
            {practitioners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>}
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="input-field shrink-0 text-sm" aria-label="Filtrează după serviciu">
            <option value="all">Toate {offerLabel(category).plural}</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
          {resources.length > 0 && <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className="input-field shrink-0 text-sm" aria-label="Filtrează după sală">
            <option value="all">Toate sălile</option>
            {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
          </select>}
          <input type="date" value={dateValue} onChange={(e) => chooseDate(e.target.value)} className="input-field shrink-0 text-sm" aria-label="Alege data" />
          <button type="button" onClick={() => setCurrentDate(new Date())} className="btn-secondary shrink-0 text-sm">Astăzi</button>
          <button type="button" onClick={() => navigatePeriod(-1)} className="calendar-icon-button" aria-label="Intervalul anterior"><ChevronLeft size={18}/></button>
          <button type="button" onClick={() => navigatePeriod(1)} className="calendar-icon-button" aria-label="Intervalul următor"><ChevronRight size={18}/></button>
          </div>
          <div className="calendar-visible-actions ml-auto">
            <label className="calendar-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Caută ${customerSingular}...`} aria-label={`Caută ${customerSingular}`}/></label>
            <button type="button" onClick={() => setBlockMode((value) => !value)} className="btn-secondary gap-1.5 text-sm" aria-pressed={blockMode}><Lock size={15}/>{blockMode ? 'Oprește blocarea' : 'Blochează intervale'}</button>
            <PrintButton />
          </div>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <input type="date" value={dateValue} onChange={(e) => chooseDate(e.target.value)} className="input-field min-w-0 flex-1 text-sm" aria-label="Alege data" />
          <button type="button" onClick={() => setShowBookingModal(true)} className="btn-primary hidden shrink-0 text-sm md:inline-flex">+ Adaugă {bookingSingular}</button>
          <button type="button" onClick={() => navigatePeriod(-1)} className="calendar-icon-button" aria-label="Intervalul anterior"><ChevronLeft size={18}/></button>
          <button type="button" onClick={() => navigatePeriod(1)} className="calendar-icon-button" aria-label="Intervalul următor"><ChevronRight size={18}/></button>
          <details className="calendar-filter-details">
            <summary className="calendar-icon-button cursor-pointer" aria-label="Deschide filtrele"><SlidersHorizontal size={18}/></summary>
            <div className="calendar-filter-popover">
              {practitioners.length > 0 && <select value={practitionerFilter} onChange={(e) => changePractitionerFilter(e.target.value)} className="input-field w-full text-sm" aria-label="Filtrează după persoană"><option value="all">{allPractitionersLabel(category)}</option>{practitioners.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>}
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="input-field w-full text-sm" aria-label="Filtrează după serviciu"><option value="all">Toate {offerLabel(category).plural}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
              {resources.length > 0 && <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className="input-field w-full text-sm" aria-label="Filtrează după sală"><option value="all">Toate sălile</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select>}
            </div>
          </details>
        </div>
        <div className="calendar-visible-actions calendar-mobile-actions lg:hidden">
          <label className="calendar-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Caută ${customerSingular}...`} aria-label={`Caută ${customerSingular}`}/></label>
          <button type="button" onClick={() => setBlockMode(value => !value)} className="btn-secondary gap-1.5 text-sm" aria-pressed={blockMode}><Lock size={15}/>{blockMode ? 'Oprește blocarea' : 'Blochează intervale'}</button>
          <PrintButton />
        </div>
      </div>
      <div className="calendar-view-switch screen-only md:hidden" role="group" aria-label="Vizualizare calendar">
        {[[Views.DAY, 'Zi'], [Views.WEEK, 'Săptămână'], [Views.MONTH, 'Lună'], [Views.AGENDA, 'Agendă']].map(([value, label]) => <button type="button" key={value} onClick={() => setView(value)} className={view === value ? 'active' : ''}>{label}</button>)}
      </div>
      {blockMode && <p className="text-xs text-amber-700 screen-only">Selectează un interval din calendar pentru a-l bloca.</p>}
      {(busy || loadingRange) && <p className="text-xs text-gray-500 screen-only">Se actualizează calendarul...</p>}
      {search && visibleEvents.length === 0 && <div className="mb-2 text-sm text-amber-700 flex items-center gap-2"><AlertTriangle size={15}/> Nu există {bookingPlural} care corespund căutării.</div>}
      <div className="calendar-workspace min-h-0 flex-1">
        <aside className="calendar-sidebar screen-only">
          <MiniCalendar date={currentDate} onSelect={setCurrentDate} />
          {practitioners.length > 0 && <div className="calendar-sidebar-card">
            <h2>{practitionerLabel(category).plural}</h2>
            <label className="calendar-filter-check"><input type="checkbox" checked={hiddenPractitionerIds.length === 0} onChange={(e) => setHiddenPractitionerIds(e.target.checked ? [] : practitioners.map((person) => person.id))} />{allPractitionersLabel(category)}</label>
            {practitioners.map((person, index) => <label key={person.id} className="calendar-filter-check"><input type="checkbox" checked={!hiddenPractitionerIds.includes(person.id)} onChange={(e) => setHiddenPractitionerIds((current) => e.target.checked ? current.filter((id) => id !== person.id) : [...current, person.id])} /><span className="calendar-avatar" style={{ background: SERVICE_COLORS[index % SERVICE_COLORS.length].background, color: SERVICE_COLORS[index % SERVICE_COLORS.length].ink }}>{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="truncate">{person.name}</span></label>)}
          </div>}
          {services.length > 0 && <div className="calendar-sidebar-card">
            <h2>{offerLabel(category).heading}</h2>
            {services.map((service, index) => <label key={service.id} className="calendar-filter-check"><input type="checkbox" checked={!hiddenServiceIds.includes(service.id)} onChange={(e) => setHiddenServiceIds((current) => e.target.checked ? current.filter((id) => id !== service.id) : [...current, service.id])} style={{ accentColor: SERVICE_COLORS[index % SERVICE_COLORS.length].border }} /><span className="truncate">{service.name}</span></label>)}
          </div>}
        </aside>
        <div className="calendar-print-sheet card printable min-h-0 min-w-0 flex-1 overflow-x-auto p-2 lg:p-3">
          <div className="calendar-period-bar screen-only">
            <div className="flex items-center gap-2"><button type="button" onClick={() => navigatePeriod(-1)} aria-label="Intervalul anterior"><ChevronLeft size={17}/></button><strong>{periodLabel}</strong><button type="button" onClick={() => navigatePeriod(1)} aria-label="Intervalul următor"><ChevronRight size={17}/></button></div>
            <div className="calendar-view-switch hidden md:flex" role="group" aria-label="Vizualizare calendar">{[[Views.MONTH, 'Lună'], [Views.WEEK, 'Săptămână'], [Views.DAY, 'Zi'], [Views.AGENDA, 'Agendă']].map(([value, label]) => <button type="button" key={value} onClick={() => setView(value)} className={view === value ? 'active' : ''}>{label}</button>)}</div>
          </div>
        <DnDCalendar
          key={`${practitionerFilter}-${calendarRevision}`}
          localizer={localizer}
          events={allEvents}
          backgroundEvents={breakEvents}
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
          step={slotIntervalMinutes}
          timeslots={Math.max(1, Math.floor(60 / slotIntervalMinutes))}
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
            noEventsInRange: `Nicio ${bookingSingular} în acest interval.`,
            showMore: (count: number) => `+${count} mai multe`,
          }}
          formats={{
            agendaDateFormat: (date: Date) => format(date, 'EEE d MMM', { locale: ro }),
            dayRangeHeaderFormat: ({ start, end }: any) =>
              `Săpt. ${getISOWeekNumber(start)} · ${format(start, 'd MMM', { locale: ro })} – ${format(end, 'd MMM', { locale: ro })}`,
          }}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={moveOrResize}
          resizable={false}
          draggableAccessor={(event: any) => !event.isBlocked && !event.isBreak}
          eventPropGetter={(event: any) => {
            if (event.isBreak) {
              return { style: { background: '#f3f4f6', color: '#6b7280', border: '1px dashed #c7cbd1', borderRadius: '8px', cursor: 'default', opacity: 0.92 } }
            }
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
            const serviceIndex = services.findIndex((service) => service.id === event.serviceId)
            const color = SERVICE_COLORS[(serviceIndex < 0 ? 0 : serviceIndex) % SERVICE_COLORS.length]
            const isInactive = event.status === 'CANCELLED' || event.status === 'NO_SHOW'
            return {
              className: event.arrivedAt ? 'calendar-arrived-event' : undefined,
              style: {
                backgroundColor: isInactive ? '#f3f4f6' : color.background,
                color: isInactive ? '#64748b' : color.ink,
                borderRadius: '7px',
                border: `1px solid ${isInactive ? '#cbd5e1' : color.border}`,
                borderLeft: `4px solid ${isInactive ? '#94a3b8' : color.border}`,
                cursor: 'pointer',
              },
            }
          }}
          components={{ event: CalendarEventCard, toolbar: () => null }}
          style={{ height: '100%' }}
        />
        </div>
      </div>

      <button type="button" onClick={() => setShowBookingModal(true)} className="calendar-mobile-add btn-primary screen-only md:hidden">+ Adaugă {bookingSingular}</button>

      {selected && (
        <BookingEditModal
          smsAvailable={smsAvailable}
          isAppointmentBased={isAppointmentBased}
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
              channel: selected.channel,
            } as BookingDetail
          }
          onClose={() => setSelected(null)}
          workingHours={(practitioners.find((p) => p.id === selected.practitionerId)?.workingHours ?? businessWorkingHours)}
          stepMinutes={slotIntervalMinutes}
        />
      )}

      {showBookingModal && (
        <CalendarQuickBookingModal
          category={category}
          isAppointmentBased={isAppointmentBased}
          isClinic={isClinic}
          businessWorkingHours={businessWorkingHours}
          stepMinutes={slotIntervalMinutes}
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

function CalendarEventCard({ event }: { event: Event | BreakEvent | BlockedEvent }) {
  if ('isBreak' in event && event.isBreak) return <div className="calendar-break-card">{event.title}<span>{format(event.start, 'HH:mm')}–{format(event.end, 'HH:mm')}</span></div>
  if ('isBlocked' in event && event.isBlocked) return <div>{event.title}</div>
  const bookingEvent = event as Event
  const duration = Math.max(1, Math.round((bookingEvent.end.getTime() - bookingEvent.start.getTime()) / 60000))
  const compact = duration <= 30
  return <div className="calendar-event-card" title={`${bookingEvent.customerName} · ${bookingEvent.serviceName} · ${bookingEvent.customerPhone}${bookingEvent.arrivedAt ? ` · ${bookingEvent.customerName} a ajuns` : ''}`}>
    <span className={`status-dot status-${bookingEvent.status.toLowerCase()}`}/>
    <div className="calendar-event-time">{format(bookingEvent.start, 'HH:mm')} – {format(bookingEvent.end, 'HH:mm')}</div>
    <div className="calendar-event-name">{bookingEvent.customerName}</div>
    {bookingEvent.arrivedAt && <div className="calendar-arrival-note" aria-label={`${bookingEvent.customerName} a ajuns`}><span className="calendar-arrival-dot" aria-hidden="true" />A ajuns</div>}
    <div className="calendar-event-service">{bookingEvent.serviceName}{!compact && bookingEvent.practitionerName ? ` · ${bookingEvent.practitionerName}` : ''}</div>
  </div>
}

function CalendarSummary({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: string }) {
  return <div className="calendar-summary-card"><span className={`calendar-summary-icon calendar-summary-${tone}`} aria-hidden="true">{icon}</span><span><strong>{value}</strong><small>{label}</small></span></div>
}

function MiniCalendar({ date, onSelect }: { date: Date; onSelect: (date: Date) => void }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const count = Math.ceil((offset + days) / 7) * 7
  const cells = Array.from({ length: count }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index - offset + 1))
  return <div className="calendar-sidebar-card calendar-mini-month">
    <div className="calendar-mini-heading"><strong>{format(date, 'LLLL yyyy', { locale: ro })}</strong><span><button type="button" onClick={() => onSelect(new Date(date.getFullYear(), date.getMonth() - 1, Math.min(date.getDate(), new Date(date.getFullYear(), date.getMonth(), 0).getDate())))} aria-label="Luna anterioară"><ChevronLeft size={16}/></button><button type="button" onClick={() => onSelect(new Date(date.getFullYear(), date.getMonth() + 1, Math.min(date.getDate(), new Date(date.getFullYear(), date.getMonth() + 2, 0).getDate())))} aria-label="Luna următoare"><ChevronRight size={16}/></button></span></div>
    <div className="calendar-mini-grid">{['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'].map((day) => <span key={day} className="calendar-mini-weekday">{day}</span>)}{cells.map((cell) => <button type="button" key={cell.toISOString()} onClick={() => onSelect(cell)} className={`${cell.getMonth() !== date.getMonth() ? 'outside' : ''} ${sameDay(cell, date) ? 'selected' : ''}`} aria-label={format(cell, 'd MMMM yyyy', { locale: ro })} aria-current={sameDay(cell, new Date()) ? 'date' : undefined}>{cell.getDate()}</button>)}</div>
  </div>
}

function CalendarQuickBookingModal({ category, onClose, onCreated, initialStart, initialPractitionerId, businessWorkingHours, stepMinutes, isAppointmentBased, isClinic }: { category: BusinessCategory; onClose: () => void; onCreated: () => void; initialStart?: Date; initialPractitionerId?: string; businessWorkingHours: { weekday: number; startTime: string; endTime: string }[]; stepMinutes: number; isAppointmentBased: boolean; isClinic: boolean }) {
  const booking = bookingTerminology(category)
  const definite = category === 'FITNESS' ? 'ședința' : category === 'CURSURI' ? 'înscrierea' : booking.singular === 'rezervare' ? 'rezervarea' : 'programarea'
  const genitive = category === 'FITNESS' ? 'ședinței' : category === 'CURSURI' ? 'înscrierii' : booking.singular === 'rezervare' ? 'rezervării' : 'programării'
  const [services, setServices] = useState<{ id: string; name: string; durationMin: number | null }[]>([])
  const [practitioners, setPractitioners] = useState<{ id: string; name: string }[]>([])
  const [isMultiPractitioner, setIsMultiPractitioner] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const [customerName, setCustomerName] = useState('')
  const [customers, setCustomers] = useState<{ id: string; name: string | null; phone: string | null }[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [practitionerId, setPractitionerId] = useState(initialPractitionerId ?? '')
  const [slotDate, setSlotDate] = useState(() => {
    const d = initialStart ?? new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [simpleDateTime, setSimpleDateTime] = useState(() => {
    const value = initialStart ? new Date(initialStart) : new Date()
    value.setMinutes(Math.ceil(value.getMinutes() / stepMinutes) * stepMinutes, 0, 0)
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}T${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`
  })
  const simpleDate = simpleDateTime.split('T')[0] ?? ''
  const simpleTime = simpleDateTime.split('T')[1] ?? ''
  const [daySlots, setDaySlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWithTimeout('/api/business/conversations/quick-booking-data?includeCustomers=true')
      .then((res) => { if (!res.ok) throw new Error('loading_failed'); return res.json() })
      .then((data) => {
        setServices(data.services ?? [])
        setCustomers(data.customers ?? [])
        setPractitioners(data.practitioners ?? [])
        setIsMultiPractitioner(!!data.isMultiPractitioner)
        if (data.practitioners?.length === 1) setPractitionerId(data.practitioners[0].id)
      })
      .catch(() => setError('Nu am putut încărca serviciile.'))
      .finally(() => setLoadingData(false))
  }, [])

  useEffect(() => {
    const selectedDate = isMultiPractitioner ? slotDate : simpleDate
    if (!serviceId || !selectedDate || (isMultiPractitioner && !practitionerId)) {
      setDaySlots([])
      return
    }
    setLoadingSlots(true)
    setSelectedSlot('')
    const practitionerParam = practitionerId ? `&practitionerId=${encodeURIComponent(practitionerId)}` : ''
    fetchWithTimeout(`/api/business/practitioner-availability?serviceId=${encodeURIComponent(serviceId)}${practitionerParam}&date=${encodeURIComponent(selectedDate)}`)
      .then((res) => res.json())
      .then((data) => {
        const slots = data.allSlots ?? []
        setDaySlots(slots)
        if (!isMultiPractitioner && simpleTime) {
          const selectedStillAvailable = slots.some((slot: { time: string; available: boolean }) =>
            slot.available && new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' }) === simpleTime
          )
          if (!selectedStillAvailable) setSimpleDateTime(`${selectedDate}T`)
        }
      })
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [isMultiPractitioner, serviceId, practitionerId, slotDate, simpleDate])

  const availableDaySlots = daySlots.filter((slot) => slot.available)
  const availableSimpleTimes = availableDaySlots.map((slot) =>
    new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
  )

  async function submit() {
    const hasDateInfo = isMultiPractitioner ? !!selectedSlot : !!simpleDateTime
    if ((!customerId && (!customerName.trim() || customerPhone.trim().length < 6)) || !serviceId || !hasDateInfo) {
      setError('Completează numele, telefonul, serviciul și data.')
      return
    }
    if (isMultiPractitioner && !practitionerId) {
      setError('Alege persoana.')
      return
    }
    if (!isMultiPractitioner && !availableSimpleTimes.includes(simpleTime)) {
      setError('Alege una dintre orele disponibile pentru această zi.')
      return
    }

    const service = services.find((s) => s.id === serviceId)
    const start = isMultiPractitioner ? new Date(selectedSlot) : new Date(simpleDateTime)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    if (start < new Date()) {
      setError(`Nu poți crea o ${booking.singular} într-un interval din trecut.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/business/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(customerId ? { customerId } : { customerName: customerName.trim(), customerPhone: customerPhone.trim() }),
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
          <h2 className="font-semibold">{booking.heading} noi</h2>
          <button onClick={onClose} aria-label="Închide">
            <X size={18} />
          </button>
        </div>

        {loadingData ? (
          <p className="text-sm text-gray-400">Se încarcă...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {customers.length > 0 && <label className="text-sm">
              {isClinic ? 'Pacient' : 'Client'}
              <select aria-label={isClinic ? 'Alege pacientul' : 'Alege clientul'} value={customerId} onChange={(e) => {
                const id = e.target.value
                const customer = customers.find((item) => item.id === id)
                setCustomerId(id)
                setCustomerName(customer?.name ?? '')
                setCustomerPhone(customer?.phone ?? '')
                setError('')
              }} className="input-field w-full mt-1">
                <option value="">{isClinic ? '+ Pacient nou' : '+ Client nou'}</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name || 'Fără nume'}{customer.phone ? ` — ${customer.phone}` : ''}</option>)}
              </select>
            </label>}
            <div className="grid grid-cols-2 gap-2">
              <input aria-label={isClinic ? 'Nume pacient' : 'Nume client'} readOnly={!!customerId} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={isClinic ? 'Nume pacient' : 'Nume client'} className="input-field" />
              <input aria-label="Telefon" readOnly={!!customerId} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Telefon" className="input-field" />
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
                    ) : availableDaySlots.length === 0 ? (
                      <p className="text-sm text-gray-500">Nicio oră disponibilă pentru această zi.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {availableDaySlots.map((slot) => {
                          const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
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
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <input
                  type="date"
                  value={simpleDate}
                  onChange={(e) => setSimpleDateTime(e.target.value && simpleTime ? `${e.target.value}T${simpleTime}` : e.target.value)}
                  className="input-field w-full"
                  aria-label={`Data ${genitive}`}
                />
                <select
                  value={simpleTime}
                  onChange={(e) => setSimpleDateTime(simpleDate ? `${simpleDate}T${e.target.value}` : '')}
                  className="input-field w-full"
                  aria-label={`Ora ${genitive} în format 24 de ore`}
                >
                  <option value="">Ora</option>
                  {availableSimpleTimes.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
                {loadingSlots && <p className="col-span-2 text-sm text-gray-400">Se încarcă orele disponibile...</p>}
                {!loadingSlots && serviceId && availableSimpleTimes.length === 0 && (
                  <p className="col-span-2 text-sm text-gray-500">Nicio oră disponibilă pentru această zi.</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button onClick={submit} disabled={saving} className="btn-primary w-full">
              {saving ? 'Se salvează...' : `Salvează ${definite}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
