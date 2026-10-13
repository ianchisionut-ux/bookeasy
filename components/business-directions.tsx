'use client'

import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'

export default function BusinessDirections({ name, address, latitude, longitude }: { name: string; address: string | null; latitude: number; longitude: number }) {
  const [locating, setLocating] = useState(false)
  const bbox = `${longitude - 0.006},${latitude - 0.004},${longitude + 0.006},${latitude + 0.004}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`

  function openDirections(origin?: { lat: number; lng: number }) {
    const url = new URL('https://www.google.com/maps/dir/')
    url.searchParams.set('api', '1')
    url.searchParams.set('destination', `${latitude},${longitude}`)
    url.searchParams.set('travelmode', 'driving')
    if (origin) url.searchParams.set('origin', `${origin.lat},${origin.lng}`)
    window.location.assign(url.toString())
  }

  function handleDirections() {
    if (!navigator.geolocation) { openDirections(); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => openDirections({ lat: coords.latitude, lng: coords.longitude }),
      () => { setLocating(false); openDirections() },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }

  return (
    <section className="mt-5 border-t border-[var(--border-soft)] pt-5" aria-label={`Locația ${name}`}>
      <h2 className="flex items-center gap-2 font-semibold"><MapPin size={18} className="text-[var(--accent)]" />Locație și direcții</h2>
      {address && <p className="mt-1 text-xs text-gray-500">{address}</p>}
      <iframe title={`Hartă pentru ${name}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" className="mt-3 h-44 w-full rounded-xl border border-[var(--border-soft)]" />
      <button type="button" onClick={handleDirections} disabled={locating} className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 disabled:opacity-60">
        <Navigation size={16} />{locating ? 'Se caută locația...' : 'Direcționează-mă acolo'}
      </button>
      <p className="mt-2 text-xs text-gray-500">Traseul se deschide în Google Maps. Poți permite accesul la locația dispozitivului.</p>
    </section>
  )
}
