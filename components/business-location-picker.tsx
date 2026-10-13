'use client'

import { useEffect, useRef, useState } from 'react'
import { ROMANIAN_CITY_COORDINATES } from '@/lib/romanian-city-coordinates'

type Position = { lat: number; lng: number }

export default function BusinessLocationPicker({ value, city, onChange }: { value: Position | null; city: string; onChange: (position: Position) => void }) {
  const mapElement = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const marker = useRef<any>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  valueRef.current = value
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    let script: HTMLScriptElement | null = null

    function initialize() {
      if (cancelled || !mapElement.current || map.current || !window.google?.maps) return
      const cityCoordinates = ROMANIAN_CITY_COORDINATES.find(([name]) => name === city)
      const center = valueRef.current ?? (cityCoordinates ? { lat: cityCoordinates[1], lng: cityCoordinates[2] } : { lat: 45.9432, lng: 24.9668 })
      map.current = new window.google.maps.Map(mapElement.current, { center, zoom: valueRef.current || cityCoordinates ? 14 : 6, streetViewControl: false, mapTypeControl: false })
      marker.current = new window.google.maps.Marker({ map: map.current, position: valueRef.current ?? undefined, draggable: true, visible: !!valueRef.current, title: 'Mută pinul la intrarea afacerii' })
      map.current.addListener('click', (event: any) => {
        const position = { lat: event.latLng.lat(), lng: event.latLng.lng() }
        marker.current.setPosition(position)
        marker.current.setVisible(true)
        onChangeRef.current(position)
      })
      marker.current.addListener('dragend', (event: any) => onChangeRef.current({ lat: event.latLng.lat(), lng: event.latLng.lng() }))
      setLoaded(true)
    }

    if (window.google?.maps) initialize()
    else {
      fetch('/api/public/maps-config', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('maps_config')))
        .then(({ apiKey }: { apiKey?: string }) => {
          if (cancelled || !apiKey) { if (!cancelled) setError(true); return }
          script = document.querySelector<HTMLScriptElement>('script[data-bookeasy-maps]')
          if (!script) {
            script = document.createElement('script')
            script.dataset.bookeasyMaps = 'true'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
            script.async = true
            document.head.appendChild(script)
          }
          script.addEventListener('load', initialize, { once: true })
          script.addEventListener('error', () => setError(true), { once: true })
          if (window.google?.maps) initialize()
        })
        .catch(() => { if (!cancelled) setError(true) })
    }
    return () => { cancelled = true; map.current = null; marker.current = null }
  // The map is created once; later position and city updates are handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map.current || !marker.current) return
    if (value) {
      marker.current.setPosition(value)
      marker.current.setVisible(true)
      map.current.setCenter(value)
    } else {
      marker.current.setVisible(false)
      const cityCoordinates = ROMANIAN_CITY_COORDINATES.find(([name]) => name === city)
      if (cityCoordinates) map.current.setCenter({ lat: cityCoordinates[1], lng: cityCoordinates[2] })
    }
  }, [value, city])

  return (
    <div>
      <div className="relative mt-3 h-60 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[#e7f2ee]">
        <div ref={mapElement} className="h-full w-full" />
        {!loaded && <div className="absolute inset-0 grid place-items-center bg-[#e7f2ee] px-4 text-center text-sm text-gray-600">{error ? 'Harta nu este disponibilă momentan. Verifică cheia Google Maps.' : 'Se încarcă harta...'}</div>}
      </div>
      <p className="mt-2 text-xs text-gray-500">Apasă pe hartă sau trage pinul la intrarea afacerii, apoi salvează setările.</p>
      {value && <p className="mt-1 text-xs font-medium text-[var(--accent)]">Pin: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}
    </div>
  )
}
