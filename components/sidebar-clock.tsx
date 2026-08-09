'use client'

import { useState, useEffect } from 'react'

export function SidebarClock({ inline }: { inline?: boolean } = {}) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // evităm mismatch de hidratare — pe server nu randăm nimic, doar după montare pe client
  if (!now) return null

  const time = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Bucharest' })
  const date = now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' })

  if (inline) {
    return (
      <div className="text-right shrink-0">
        <p className="text-xl font-semibold tabular-nums tracking-tight leading-tight">{time}</p>
        <p className="text-xs text-gray-500 capitalize leading-tight">{date}</p>
      </div>
    )
  }

  return (
    <div className="px-2 py-3 mb-1">
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{time}</p>
      <p className="text-xs text-gray-500 capitalize">{date}</p>
    </div>
  )
}
