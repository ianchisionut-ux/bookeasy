'use client'

import { MapPin, Navigation } from 'lucide-react'

export default function BusinessDirections({ name, address, latitude, longitude }: { name: string; address: string | null; latitude: number; longitude: number }) {
  const bbox = `${longitude - 0.006},${latitude - 0.004},${longitude + 0.006},${latitude + 0.004}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`

  function openDirections() {
    const url = new URL('https://www.google.com/maps/dir/')
    url.searchParams.set('api', '1')
    url.searchParams.set('destination', `${latitude},${longitude}`)
    url.searchParams.set('travelmode', 'driving')
    window.location.assign(url.toString())
  }

  return (
    <section className="mt-5 border-t border-[var(--border-soft)] pt-5" aria-label={`Locația ${name}`}>
      <h2 className="flex items-center gap-2 font-semibold"><MapPin size={18} className="text-[var(--accent)]" />Locație și direcții</h2>
      {address && <p className="mt-1 text-xs text-gray-500">{address}</p>}
      <iframe title={`Hartă pentru ${name}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" className="mt-3 h-44 w-full rounded-xl border border-[var(--border-soft)]" />
      <p className="mt-1 text-[10px] text-gray-500">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Geoapify</a></p>
      <button type="button" onClick={openDirections} className="btn-secondary mt-3 flex w-full items-center justify-center gap-2">
        <Navigation size={16} />Direcționează-mă acolo
      </button>
      <p className="mt-2 text-xs text-gray-500">Traseul se deschide în Google Maps, unde poți alege punctul de plecare.</p>
    </section>
  )
}
