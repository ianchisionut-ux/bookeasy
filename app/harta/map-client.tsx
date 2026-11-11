'use client'

import { getClientLocation } from '@/lib/client-geolocation'
import { loadOsmMap, addOsmTiles } from '@/lib/osm-map'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL, PUBLIC_CATEGORY_GROUPS, type PublicCategory } from '@/lib/business-categories'

type Business = {
  id: string
  name: string
  slug: string
  category: PublicCategory
  city: string | null
  address: string | null
  latitude: number
  longitude: number
  rating: number | null
  reviewCount: number | null
}


const MARKER_THEMES = {
  beauty: { color: '#a44f87', icon: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 8l12 12M8 16L20 4"/>' },
  education: { color: '#bf7845', icon: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>' },
  health: { color: '#0d929c', icon: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>' },
  sport: { color: '#386dae', icon: '<path d="M6 7v10M3 9v6M9 5v14M18 7v10M21 9v6M15 5v14M9 12h6"/>' },
  services: { color: '#6d55a5', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h8"/>' },
} as const

function markerTheme(category: PublicCategory) {
  const group = PUBLIC_CATEGORY_GROUPS.find(item => item.categories.some(value => value === category))?.id
  return group ? MARKER_THEMES[group] : MARKER_THEMES.services
}

function markerIcon(L: any, category: PublicCategory) {
  const { color, icon } = markerTheme(category)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 56 68"><path d="M28 2C13 2 2 13 2 28c0 21 26 38 26 38s26-17 26-38C54 13 43 2 28 2Z" fill="${color}" stroke="white" stroke-width="3"/><g transform="translate(16 16)" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${icon}</g></svg>`
  return L.divIcon({ className: '', html: svg, iconSize: [48,58], iconAnchor: [24,56], popupAnchor: [0,-55] })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const libraryRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const userPositionRef = useRef<{ lat: number; lng: number } | null>(null)
  const locationRequestedRef = useRef(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [category, setCategory] = useState<'ALL' | PublicCategory>('ALL')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'found' | 'unavailable'>('idle')

  function centerOnUser(position: { lat: number; lng: number }) {
    const L = libraryRef.current
    if (!mapInstance.current || !L) return
    mapInstance.current.setView([position.lat, position.lng], 12)
    userMarkerRef.current?.remove()
    userMarkerRef.current = L.circleMarker([position.lat,position.lng], {radius:9,color:'#fff',weight:3,fillColor:'#2563eb',fillOpacity:1}).addTo(mapInstance.current).bindTooltip('Locația ta')
  }

  async function requestLocation(userInitiated = false) {
    setLocationStatus('locating')
    const coords = await getClientLocation(userInitiated)
    if (!coords) { setLocationStatus('unavailable'); return }
    const position = { lat: coords.latitude, lng: coords.longitude }
    userPositionRef.current = position
    setLocationStatus('found')
    centerOnUser(position)
  }

  useEffect(() => {
    if (!shouldLoad || locationRequestedRef.current) return
    locationRequestedRef.current = true
    requestLocation()
  }, [shouldLoad])

  // Harta se încarcă doar când devine vizibilă. O încărcăm doar
  // când utilizatorul se apropie de hartă, nu la primul paint al landing page-ului.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '300px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!shouldLoad) return
    let cancelled = false
    let resize: ResizeObserver | undefined
    loadOsmMap().then(L => {
      if (cancelled || !mapRef.current) return
      libraryRef.current = L
      mapInstance.current = L.map(mapRef.current).setView([45.9432,24.9668],6)
      addOsmTiles(L,mapInstance.current)
      resize = new ResizeObserver(() => mapInstance.current?.invalidateSize())
      resize.observe(mapRef.current)
      setLoaded(true)
      if (userPositionRef.current) centerOnUser(userPositionRef.current)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true; resize?.disconnect(); mapInstance.current?.remove(); mapInstance.current = null; markersRef.current = []; userMarkerRef.current = null }
  }, [shouldLoad])

  // fetch businesses ori de câte ori se schimbă filtrul
  useEffect(() => {
    if (!shouldLoad) return
    const params = new URLSearchParams()
    if (category !== 'ALL') params.set('category', category)

    const controller = new AbortController()
    fetch(`/api/businesses/map?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => {})
    return () => controller.abort()
  }, [category, shouldLoad])

  // reafișează markerele de fiecare dată când se schimbă lista de businessuri
  useEffect(() => {
    if (!loaded || !mapInstance.current) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const L = libraryRef.current
    if (!L) return

    const validBusinesses = businesses.filter(
      (b) => Number.isFinite(b.latitude) && Number.isFinite(b.longitude) && Math.abs(b.latitude) <= 90 && Math.abs(b.longitude) <= 180,
    )

    validBusinesses.forEach((b) => {
      const marker = L.marker([b.latitude,b.longitude], {title:b.name,icon:markerIcon(L,b.category)}).addTo(mapInstance.current)
      marker.bindPopup(`
          <div style="font-family:var(--font-sans),sans-serif; padding:4px;">
            <p style="font-weight:600; margin:0 0 2px;">${escapeHtml(b.name)}</p>
            <p style="font-size:11px; color:${markerTheme(b.category).color}; font-weight:600; margin:0 0 4px;">${escapeHtml(CATEGORY_LABEL[b.category])}</p>
            <p style="font-size:12px; color:#666; margin:0 0 4px;">${escapeHtml(b.address ?? b.city ?? '')}</p>
            ${b.rating ? `<p style="font-size:12px; margin:0 0 6px;">★ ${b.rating} (${b.reviewCount ?? 0} recenzii)</p>` : ''}
            <a href="/${encodeURIComponent(b.slug)}" style="font-size:13px; color:#0c2c53;">Vezi profil →</a>
          </div>
        `)


      markersRef.current.push(marker)
    })

    // Când locația este disponibilă, utilizatorul rămâne în centrul hărții.
    // Fără permisiune, încadrăm afacerile afișate.
    if (userPositionRef.current) {
      centerOnUser(userPositionRef.current)
    } else if (validBusinesses.length === 1) {
      mapInstance.current.setView([validBusinesses[0].latitude, validBusinesses[0].longitude],13)
    } else if (validBusinesses.length > 1) {
      mapInstance.current.fitBounds(validBusinesses.map(b => [b.latitude,b.longitude]), {padding:[40,40],maxZoom:13})
    } else {
      mapInstance.current.panTo([45.9432,24.9668])
      mapInstance.current.setZoom(6)
    }
  }, [businesses, loaded])

  return (
    <div ref={containerRef} className="flex flex-col p-4 lg:p-6">
      <div className="px-4 py-3 border rounded-t-xl bg-white flex flex-wrap items-center gap-3">
        <label htmlFor="map-category" className="text-sm font-medium">Categorie</label>
        <select id="map-category" value={category} onChange={(event) => setCategory(event.target.value as 'ALL' | PublicCategory)} className="input-field max-w-xs min-w-44">
          <option value="ALL">Toate categoriile</option>
          {PUBLIC_CATEGORY_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>
            {group.categories.map((item) => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}
          </optgroup>)}
        </select>
        <button type="button" onClick={() => void requestLocation(true)} disabled={locationStatus === 'locating'} className="text-sm px-3 py-2 rounded-xl border border-[var(--border-soft)] hover:bg-gray-50 disabled:opacity-50">
          {locationStatus === 'locating' ? 'Se caută locația...' : 'Locația mea'}
        </button>
        <span className="text-sm text-gray-500 ml-auto self-center">{businesses.length} afaceri</span>
      </div>

      <div className="relative isolate z-0 h-[350px] sm:h-[450px] lg:h-[500px] rounded-b-xl overflow-hidden border border-t-0">
        {!loaded && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-white z-[1000]">
            {shouldLoad ? 'Se încarcă harta...' : 'Harta se încarcă atunci când ajungi aici.'}
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center gap-4 text-sm text-gray-500 px-6 py-8 text-center overflow-y-auto bg-white z-10">
            <p>Harta nu poate fi afișată momentan. Reîncarcă pagina sau deschide profilul unei afaceri.</p>
            {businesses.length > 0 && (
              <div className="w-full max-w-md flex flex-col gap-2 text-left">
                {businesses.map((b) => (
                  <div key={b.id} className="border rounded-lg px-4 py-3">
                    <p className="font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500">
                      {b.address ?? b.city} {b.rating ? `· ★ ${b.rating}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        {loaded && (
          <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] bg-white/95 rounded-xl shadow-md px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] z-[1000] mb-4">
            {PUBLIC_CATEGORY_GROUPS.map(group => <span key={group.id} className="flex items-center gap-1" style={{color:MARKER_THEMES[group.id].color}}><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{background:MARKER_THEMES[group.id].color}}/>{group.label}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}
