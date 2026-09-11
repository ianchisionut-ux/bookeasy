'use client'

import dynamic from 'next/dynamic'

// react-big-calendar (via date-fns) face calcule de dată/oră care depind de
// timezone-ul runtime-ului (getDay, startOfWeek, format etc. nu primesc un
// timeZone explicit). Pe Cloudflare Workers randarea server rulează de regulă
// în UTC, diferit de timezone-ul clientului (Europe/Bucharest) -> React
// hydration error #418 la orele de graniță ale zilei.
//
// ssr: false scoate complet acest component din randarea server-side, deci
// nu mai există niciun HTML de comparat la hidratare pentru el.
const CalendarClient = dynamic(() => import('./calendar-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-sm text-gray-400">
      Se încarcă calendarul...
    </div>
  ),
})

export default CalendarClient
