'use client'

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { ro }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ro }),
  getDay,
  locales,
})

type Event = {
  id: string
  title: string
  start: Date
  end: Date
  status: string
  resourceId?: string
}

type Resource = { resourceId: string; resourceTitle: string }

export default function CalendarClient({ events, resources }: { events: Event[]; resources?: Resource[] }) {
  const hasResources = resources && resources.length > 0

  return (
    <div className="h-[calc(100vh-40px)] p-8 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Calendar rezervări</h1>
        {hasResources && <p className="text-sm text-gray-500">Vedere pe angajați — {resources!.length} activi</p>}
      </div>
      <div className="card p-4 flex-1 min-h-0">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          culture="ro"
          defaultView={hasResources ? 'day' : 'week'}
          views={hasResources ? ['day', 'agenda'] : ['week', 'day', 'agenda']}
          resources={hasResources ? resources : undefined}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          eventPropGetter={(event: Event) => ({
            style: {
              backgroundColor:
                event.status === 'CONFIRMED' ? '#16a34a' : event.status === 'PENDING' ? '#eab308' : '#ef4444',
              borderRadius: '8px',
              border: 'none',
            },
          })}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
