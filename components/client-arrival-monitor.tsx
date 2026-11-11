'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { canReadLocationWithoutPrompt, requestClientPosition } from '@/lib/client-geolocation'
import { usePathname } from 'next/navigation'
import { ARRIVAL_CHANGED_EVENT, ARRIVAL_STORAGE_KEY, readClientArrivals, writeClientArrivals, type ClientArrival } from '@/lib/client-arrival'

const POLL_MS = 15_000

export default function ClientArrivalMonitor() {
  const pathname = usePathname()
  const [entries, setEntries] = useState<ClientArrival[]>([])
  const [visible, setVisible] = useState(true)
  const [checking, setChecking] = useState(false)
  const [needsLocation, setNeedsLocation] = useState(false)
  const [locationRequest, setLocationRequest] = useState(0)
  const consumedRequest = useRef(0)
  const isPublicPage = !/^\/(dashboard|superadmin|admin|api)(\/|$)/.test(pathname ?? '')

  const refresh = useCallback(() => {
    const saved = readClientArrivals()
    const current = saved.filter((entry) => Date.parse(entry.startAt) > Date.now() - 30 * 60_000)
    if (current.length !== saved.length) {
      try { writeClientArrivals(current) } catch { /* stocarea poate fi indisponibilă */ }
    }
    setEntries(current)
  }, [])
  useEffect(() => {
    refresh()
    const onVisibility = () => setVisible(document.visibilityState === 'visible')
    window.addEventListener(ARRIVAL_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener(ARRIVAL_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  useEffect(() => {
    if (!isPublicPage || !visible || !entries.length || !navigator.geolocation) return
    let cancelled = false
    let inFlight = false

    const explicitRequest = locationRequest > consumedRequest.current
    consumedRequest.current = locationRequest

    async function check(allowPrompt = false) {
      if (inFlight || cancelled) return
      const now = Date.now()
      const eligible = readClientArrivals().filter((entry) => {
        const gap = Date.parse(entry.startAt) - now
        return gap <= 2 * 60 * 60_000 && gap >= -15 * 60_000
      })
      if (!eligible.length) return
      if (!allowPrompt && !await canReadLocationWithoutPrompt()) {
        if (!cancelled) setNeedsLocation(true)
        return
      }
      if (cancelled) return
      setNeedsLocation(false)
      inFlight = true
      setChecking(true)
      try {
        const position = await requestClientPosition(allowPrompt, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 })
        if (!position) {
          if (!cancelled) setNeedsLocation(!await canReadLocationWithoutPrompt())
          return
        }
        if (cancelled) return
        for (const entry of eligible) {
          const response = await fetch(`/api/public/bookings/${encodeURIComponent(entry.bookingId)}/arrival`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: entry.token,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          })
          if (cancelled) return
          const result = await response.json().catch(() => null)
          if (result?.arrived || response.status === 404 || response.status === 409) {
            writeClientArrivals(readClientArrivals().filter((saved) => saved.bookingId !== entry.bookingId))
          }
        }
      } catch (error) {
        if (!cancelled && (error as GeolocationPositionError)?.code === 1) setNeedsLocation(true)
        // Timer retries only when the browser already grants access; it never reopens a permission prompt.
      } finally {
        if (!cancelled) setChecking(false)
        inFlight = false
      }
    }

    void check(explicitRequest)
    const timer = window.setInterval(() => void check(), POLL_MS)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [entries, isPublicPage, visible, locationRequest])

  const now = Date.now()
  const active = isPublicPage && entries.some((entry) => {
    const gap = Date.parse(entry.startAt) - now
    return gap <= 2 * 60 * 60_000 && gap >= -15 * 60_000
  })
  if (!active) return null

  return <div className="fixed bottom-20 right-3 z-40 flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border border-teal-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-md sm:bottom-4" role="status">
    <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden="true" />
    <span>{checking ? 'Verificăm sosirea…' : needsLocation ? 'Anunțul de sosire are nevoie de locație' : 'Anunț de sosire activ cât pagina este deschisă'}</span>
    {needsLocation && <button type="button" className="shrink-0 font-semibold text-teal-700 underline" onClick={() => setLocationRequest((value) => value + 1)}>Activează locația</button>}
    <button type="button" className="shrink-0 font-semibold text-teal-700 underline" onClick={() => {
      try { localStorage.removeItem(ARRIVAL_STORAGE_KEY) } catch { /* spațiu indisponibil */ }
      window.dispatchEvent(new Event(ARRIVAL_CHANGED_EVENT))
    }}>Oprește</button>
  </div>
}
