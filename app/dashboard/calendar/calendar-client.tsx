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
}

type Resource = { resourceId: string; resourceTitle: string }
type StaffOption = { id: string; name: string }

export default function CalendarClient({
  events,
  resources,
  staffOptions,
}: {
  events: Event[]
  resources?: Resource[]
  staffOptions: StaffOption[]
}) {
  const router = useRouter()
  const hasResources = resources && resources.length > 0
  const [selected, setSelected] = useState<Event | null>(null)
  const [view, setView] = useState<any>(hasResources ? Views.DAY : Views.WEEK)

  // pe telefon, vederea de săptămână/lună e ilizibilă — pornim direct pe "Zi"
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setView(Views.DAY)
    }
  }, [])

  const moveOrResize = useCallback(
    async ({ event, start, end, resourceId }: any) => {
      const oldTime = new Date(event.start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
      const newTime = new Date(start).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })
      const confirmed = confirm(
        `Muți programarea "${event.customerName} — ${event.serviceName}" din ${oldTime} în ${newTime}?`
      )
      if (!confirmed) return // nu apelăm API-ul — la următorul render, evenimentul revine la poziția originală (vine tot din props, neschimbate)

      await fetch(`/api/business/bookings/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: new Date(start).toISOString(),
          endAt: new Date(end).toISOString(),
          ...(resourceId ? { staffId: resourceId } : {}),
        }),
      })
      router.refresh()
    },
    [router]
  )

  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-40px)] p-4 lg:p-8 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <h1 className="text-xl lg:text-2xl font-semibold">Calendar rezervări</h1>
        <p className="text-xs lg:text-sm text-gray-500">Trage o rezervare ca s-o muți — click pentru detalii/editare</p>
      </div>
      <div className="card p-2 lg:p-4 flex-1 min-h-0 overflow-x-auto">
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          culture="ro"
          view={view}
          onView={setView}
          views={hasResources ? [Views.DAY, Views.WEEK, Views.AGENDA] : [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          resources={hasResources && (view === Views.DAY || view === Views.WEEK) ? resources : undefined}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          onEventDrop={moveOrResize}
          onEventResize={moveOrResize}
          resizable
          onSelectEvent={(event: Event) => setSelected(event)}
          eventPropGetter={(event: Event) => ({
            style: {
              backgroundColor:
                event.status === 'CONFIRMED' ? '#16a34a' : event.status === 'PENDING' ? '#eab308' : '#ef4444',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            },
          })}
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
