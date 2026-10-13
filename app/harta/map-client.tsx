'use client'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL, PUBLIC_CATEGORY_GROUPS, type PublicCategory } from '@/lib/business-categories'
import { CalendarDays, Dumbbell, Heart, Scissors, Stethoscope } from 'lucide-react'

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

declare global {
  interface Window {
    google: any
    gm_authFailure?: () => void
  }
}

const MARKER_THEMES = {
  beauty: { color: '#a44f87', icon: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 8l12 12M8 16L20 4"/>' },
  wellness: { color: '#bf7845', icon: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>' },
  health: { color: '#0d929c', icon: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>' },
  sport: { color: '#386dae', icon: '<path d="M6 7v10M3 9v6M9 5v14M18 7v10M21 9v6M15 5v14M9 12h6"/>' },
  experiences: { color: '#6d55a5', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h8"/>' },
} as const

function markerTheme(category: PublicCategory) {
  const group = PUBLIC_CATEGORY_GROUPS.find((item) => item.categories.some((value) => value === category))?.id
  if (group === 'beauty' || category === 'STUDIO_BEAUTY') return MARKER_THEMES.beauty
  if (group === 'wellness') return MARKER_THEMES.wellness
  if (group === 'health') return MARKER_THEMES.health
  if (group === 'sport' || category === 'ACCES_CLUB') return MARKER_THEMES.sport
  return MARKER_THEMES.experiences
}

function markerIcon(category: PublicCategory) {
  const { color, icon } = markerTheme(category)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="68" viewBox="0 0 56 68"><path d="M28 2C13 2 2 13 2 28c0 21 26 38 26 38s26-17 26-38C54 13 43 2 28 2Z" fill="${color}" stroke="white" stroke-width="3"/><g transform="translate(16 16)" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${icon}</g></svg>`
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new window.google.maps.Size(48, 58), anchor: new window.google.maps.Point(24, 56) }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
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
    if (!mapInstance.current || !window.google?.maps) return
    mapInstance.current.setCenter(position)
    mapInstance.current.setZoom(12)
    userMarkerRef.current?.setMap(null)
    userMarkerRef.current = new window.google.maps.Marker({
      position,
      map: mapInstance.current,
      title: 'Locația ta',
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
      zIndex: 1000,
    })
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('unavailable'); return }
    setLocationStatus('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude }
        userPositionRef.current = position
        setLocationStatus('found')
        centerOnUser(position)
      },
      () => setLocationStatus('unavailable'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }

  useEffect(() => {
    if (!shouldLoad || locationRequestedRef.current) return
    locationRequestedRef.current = true
    requestLocation()
  }, [shouldLoad])

  // Google Maps este una dintre cele mai grele resurse ale paginii. O încărcăm doar
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

  // încarcă scriptul Google Maps o singură dată
  useEffect(() => {
    if (!shouldLoad) return
    if (window.google?.maps) {
      setLoaded(true)
      return
    }
    const controller = new AbortController()
    let script: HTMLScriptElement | null = null
    fetch('/api/public/maps-config', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Config indisponibil')))
      .then(({ apiKey }: { apiKey?: string }) => {
        if (!apiKey) throw new Error('Cheie Google Maps lipsă')
        script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
        script.async = true
        script.onload = () => setLoaded(true)
        script.onerror = () => setLoadError(true)
        document.head.appendChild(script)
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setLoadError(true)
      })
    // Google apelează asta când cheia e respinsă (referrer greșit, API dezactivat, facturare
    // neactivată etc.) — de multe ori FĂRĂ niciun mesaj vizual pe hartă, doar spațiu gol
    window.gm_authFailure = () => setLoadError(true)
    return () => {
      controller.abort()
      delete window.gm_authFailure
    }
  }, [shouldLoad])

  // inițializează harta după ce s-a încărcat scriptul
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: userPositionRef.current ?? { lat: 45.9432, lng: 24.9668 },
      zoom: userPositionRef.current ? 12 : 6,
      // fără mapId — folosim randarea clasică raster, cea mai compatibilă,
      // fără să depindă de un Map ID creat separat în Google Cloud Console
    })
    if (userPositionRef.current) centerOnUser(userPositionRef.current)
  }, [loaded])

  // urmărește dimensiunea reală a containerului și forțează Google Maps să se
  // recalculeze de fiecare dată când se schimbă — repară cazul în care harta a fost
  // creată înainte ca layout-ul paginii (ex: fontul încărcat asincron) să se stabilizeze,
  // situație în care Google Maps "îngheață" pe o dimensiune greșită, o singură dată
  useEffect(() => {
    if (!loaded || !mapRef.current) return

    const observer = new ResizeObserver(() => {
      if (!mapInstance.current) return
      const currentCenter = mapInstance.current.getCenter()
      window.google.maps.event.trigger(mapInstance.current, 'resize')
      if (currentCenter) mapInstance.current.setCenter(currentCenter)
    })
    observer.observe(mapRef.current)

    return () => observer.disconnect()
  }, [loaded])

  // fetch businesses ori de câte ori se schimbă filtrul
  useEffect(() => {
    if (!shouldLoad) return
    const params = new URLSearchParams()
    if (category !== 'ALL') params.set('category', category)

    fetch(`/api/businesses/map?${params}`)
      .then((r) => r.json())
      .then((data) => setBusinesses(data.businesses ?? []))
  }, [category, shouldLoad])

  // reafișează markerele de fiecare dată când se schimbă lista de businessuri
  useEffect(() => {
    if (!loaded || !mapInstance.current) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const infoWindow = new window.google.maps.InfoWindow()

    const validBusinesses = businesses.filter(
      (b) => Number.isFinite(b.latitude) && Number.isFinite(b.longitude) && Math.abs(b.latitude) <= 90 && Math.abs(b.longitude) <= 180,
    )

    validBusinesses.forEach((b) => {
      const marker = new window.google.maps.Marker({
        position: { lat: b.latitude, lng: b.longitude },
        map: mapInstance.current,
        title: b.name,
        icon: markerIcon(b.category),
      })

      marker.addListener('click', () => {
        infoWindow.setContent(`
          <div style="font-family:var(--font-sans),sans-serif; padding:4px;">
            <p style="font-weight:600; margin:0 0 2px;">${escapeHtml(b.name)}</p>
            <p style="font-size:11px; color:${markerTheme(b.category).color}; font-weight:600; margin:0 0 4px;">${escapeHtml(CATEGORY_LABEL[b.category])}</p>
            <p style="font-size:12px; color:#666; margin:0 0 4px;">${escapeHtml(b.address ?? b.city ?? '')}</p>
            ${b.rating ? `<p style="font-size:12px; margin:0 0 6px;">★ ${b.rating} (${b.reviewCount ?? 0} recenzii)</p>` : ''}
            <a href="/${encodeURIComponent(b.slug)}" style="font-size:13px; color:#0c2c53;">Vezi profil →</a>
          </div>
        `)
        infoWindow.open(mapInstance.current, marker)
      })

      markersRef.current.push(marker)
    })

    // Când locația este disponibilă, utilizatorul rămâne în centrul hărții.
    // Fără permisiune, încadrăm afacerile afișate.
    if (userPositionRef.current) {
      centerOnUser(userPositionRef.current)
    } else if (validBusinesses.length === 1) {
      mapInstance.current.setCenter({ lat: validBusinesses[0].latitude, lng: validBusinesses[0].longitude })
      mapInstance.current.setZoom(13)
    } else if (validBusinesses.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      validBusinesses.forEach((b) => bounds.extend({ lat: b.latitude, lng: b.longitude }))
      mapInstance.current.fitBounds(bounds, 64)
      window.google.maps.event.addListenerOnce(mapInstance.current, 'idle', () => {
        if ((mapInstance.current?.getZoom() ?? 0) > 13) mapInstance.current.setZoom(13)
      })
    } else {
      mapInstance.current.setCenter({ lat: 45.9432, lng: 24.9668 })
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
        <button type="button" onClick={() => userPositionRef.current ? centerOnUser(userPositionRef.current) : requestLocation()} disabled={locationStatus === 'locating'} className="text-sm px-3 py-2 rounded-xl border border-[var(--border-soft)] hover:bg-gray-50 disabled:opacity-50">
          {locationStatus === 'locating' ? 'Se caută locația...' : 'Locația mea'}
        </button>
        <span className="text-sm text-gray-500 ml-auto self-center">{businesses.length} afaceri</span>
      </div>

      <div className="relative h-[350px] sm:h-[450px] lg:h-[500px] rounded-b-xl overflow-hidden border border-t-0">
        {!loaded && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-white z-10">
            {shouldLoad ? 'Se încarcă harta...' : 'Harta se încarcă atunci când ajungi aici.'}
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center gap-4 text-sm text-gray-500 px-6 py-8 text-center overflow-y-auto bg-white z-10">
            <p>Harta nu poate fi afișată momentan (cheie Google Maps lipsă sau invalidă).</p>
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
        {/* containerul hărții rămâne mereu randat, la dimensiune reală — nu-l ascundem
            niciodată cu display:none, ca Google Maps să nu-l "vadă" la 0×0 în momentul creării */}
        <div ref={mapRef} className="w-full h-full" />

        {loaded && (
          <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] bg-white/95 rounded-xl shadow-md px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] z-10">
            <span className="flex items-center gap-1" style={{ color: MARKER_THEMES.beauty.color }}><Scissors size={14} />Beauty</span>
            <span className="flex items-center gap-1" style={{ color: MARKER_THEMES.wellness.color }}><Heart size={14} />Wellness</span>
            <span className="flex items-center gap-1" style={{ color: MARKER_THEMES.health.color }}><Stethoscope size={14} />Sănătate</span>
            <span className="flex items-center gap-1" style={{ color: MARKER_THEMES.sport.color }}><Dumbbell size={14} />Sport</span>
            <span className="flex items-center gap-1" style={{ color: MARKER_THEMES.experiences.color }}><CalendarDays size={14} />Experiențe</span>
          </div>
        )}
      </div>
    </div>
  )
}
