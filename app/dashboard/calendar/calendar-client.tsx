'use client'

import { useState, useCallback, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import BookingEditModal, { BookingDetail } from '@/components/booking-edit-modal'

const locales = { ro }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ro }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(Calendar) as any

type Event = {
  id: string
  title: string
  start: Date
  end: Date
  status: string
  resourceId?: string
  customerName: string
  serviceName: string
  staffId: string | null
  isBlocked?: false
}

type BlockedEvent = {
  id: string
  title: string
  start: Date
  end: Date
  isBlocked: true
}

type Resource = { resourceId: string; resourceTitle: string }
type StaffOption = { id: string; name: string }
type BlockedSlot = { id: string; startAt: string; endAt: string; reason: string | null }

export default function CalendarClient({
  events,
  resources,
  staffOptions,
  blockedSlots,
}: {
  events: Event[]
  resources?: Resource[]
  staffOptions: StaffOption[]
  blockedSlots: BlockedSlot[]
}) {
  const router = useRouter()
  const hasResources = resources && resources.length > 0
  const [selected, setSelected] = useState<Event | null>(null)
  const [view, setView] = useState<any>(hasResources ? Views.DAY : Views.WEEK)
  const [busy, setBusy] = useState(false)

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

  const allEvents = [...events, ...blockedEvents]

  const blockRange = useCallback(
    async (start: Date, end: Date) => {
      const reason = prompt('Blochezi acest interval. Vrei să adaugi un motiv? (opțional, lasă gol dacă nu)')
      if (reason === null) return // Anulează la prompt

      setBusy(true)
      const res = await fetch('/api/business/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt: start.toISOString(), endAt: end.toISOString(), reason: reason || undefined }),
      })
      setBusy(false)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut bloca intervalul.')
        return
      }
      router.refresh()
    },
    [router]
  )

  const unblockSlot = useCallback(
    async (id: string) => {
      const confirmed = confirm('Deblochezi acest interval?')
      if (!confirmed) return
      setBusy(true)
      await fetch(`/api/business/blocked-slots/${id}`, { method: 'DELETE' })
      setBusy(false)
      router.refresh()
    },
    [router]
  )

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date; end: Date }) => {
      blockRange(slotInfo.start, slotInfo.end)
    },
    [blockRange]
  )

  const handleSelectEvent = useCallback(
    (event: Event | BlockedEvent) => {
      if ('isBlocked' in event && event.isBlocked) {
        unblockSlot(event.id)
      } else {
        setSelected(event as Event)
      }
    },
    [unblockSlot]
  )

  const moveOrResize = useCallback(
    async ({ event, start, end, resourceId }: any) => {
      if (event.isBlocked) return // blocurile nu se mută prin drag — se șterg prin click

      const oldTime = new Date(event.start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
      const newTime = new Date(start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
      const confirmed = confirm(
        `Muți programarea "${event.customerName} — ${event.serviceName}" din ${oldTime} în ${newTime}?`
      )
      if (!confirmed) return

      const res = await fetch(`/api/business/bookings/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          ...(resourceId ? { staffId: resourceId } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut muta rezervarea.')
        return
      }
      router.refresh()
    },
    [router]
  )

  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-40px)] p-4 lg:p-8 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <h1 className="text-xl lg:text-2xl font-semibold">Calendar rezervări</h1>
        <p className="text-xs lg:text-sm text-gray-500">
          Selectează cu mouse-ul un interval liber ca să-l blochezi — click pe zonă blocată pentru a o debloca
          {busy && <span className="text-gray-400"> · se actualizează...</span>}
        </p>
      </div>
      <div className="card p-2 lg:p-4 flex-1 min-h-0 overflow-x-auto">
        <DnDCalendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          culture="ro"
          view={view}
          onView={setView}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          resources={hasResources && (view === Views.DAY || view === Views.WEEK) ? resources : undefined}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={moveOrResize}
          onEventResize={moveOrResize}
          resizable
          draggableAccessor={(event: any) => !event.isBlocked}
          eventPropGetter={(event: any) => {
            if (event.isBlocked) {
              return {
                style: {
                  backgroundColor: 'repeating-linear-gradient(45deg, #d1d5db, #d1d5db 6px, #e5e7eb 6px, #e5e7eb 12px)' as any,
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
              customerName: selected.customerName,
              serviceName: selected.serviceName,
              startAt: selected.start.toISOString(),
              endAt: selected.end.toISOString(),
              status: selected.status as BookingDetail['status'],
              staffId: selected.staffId,
              staffName: null,
            } as BookingDetail
          }
          staffOptions={staffOptions}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
