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
}

export default function CalendarClient({ events }: { events: Event[] }) {
  return (
    <div className="h-[calc(100vh-40px)] p-8 flex flex-col">
      <h1 className="text-2xl font-semibold mb-4">Calendar rezervări</h1>
      <div className="card p-4 flex-1 min-h-0">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          culture="ro"
          eventPropGetter={(event) => ({
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
