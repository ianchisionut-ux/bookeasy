'use client'

import { useEffect, useRef, useState } from 'react'

type Business = {
  id: string
  name: string
  slug: string
  category: 'SALON' | 'EVENT_VENUE'
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
    initBookeasyMap?: () => void
    gm_authFailure?: () => void
  }
}

export default function MapClient() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [category, setCategory] = useState<'ALL' | 'SALON' | 'EVENT_VENUE'>('ALL')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // încarcă scriptul Google Maps o singură dată
  useEffect(() => {
    if (window.google?.maps) {
      setLoaded(true)
      return
    }
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setLoadError(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&loading=async&callback=initBookeasyMap`
    script.async = true
    script.onerror = () => setLoadError(true)
    window.initBookeasyMap = () => setLoaded(true)
    // Google apelează asta când cheia e respinsă (referrer greșit, API dezactivat, facturare
    // neactivată etc.) — de multe ori FĂRĂ niciun mesaj vizual pe hartă, doar spațiu gol
    window.gm_authFailure = () => setLoadError(true)
    document.head.appendChild(script)
    return () => {
      delete window.initBookeasyMap
      delete window.gm_authFailure
    }
  }, [])

  // inițializează harta după ce s-a încărcat scriptul
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 46.1667, lng: 21.3167 }, // centru aprox. Cluj-Napoca
      zoom: 7,
      // fără mapId — folosim randarea clasică raster, cea mai compatibilă,
      // fără să depindă de un Map ID creat separat în Google Cloud Console
    })
  }, [loaded])

  // fetch businesses ori de câte ori se schimbă filtrul
  useEffect(() => {
    const params = new URLSearchParams()
    if (category !== 'ALL') params.set('category', category)

    fetch(`/api/businesses/map?${params}`)
      .then((r) => r.json())
      .then((data) => setBusinesses(data.businesses ?? []))
  }, [category])

  // reafișează markerele de fiecare dată când se schimbă lista de businessuri
  useEffect(() => {
    if (!loaded || !mapInstance.current) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    const infoWindow = new window.google.maps.InfoWindow()

    businesses.forEach((b) => {
      const marker = new window.google.maps.Marker({
        position: { lat: b.latitude, lng: b.longitude },
        map: mapInstance.current,
        title: b.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: b.category === 'SALON' ? '#639922' : '#0c2c53',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })

      marker.addListener('click', () => {
        infoWindow.setContent(`
          <div style="font-family:sans-serif; padding:4px;">
            <p style="font-weight:600; margin:0 0 2px;">${b.name}</p>
            <p style="font-size:11px; color:${b.category === 'SALON' ? '#639922' : '#0c2c53'}; font-weight:600; margin:0 0 4px;">${b.category === 'SALON' ? 'Salon' : 'Spații evenimente'}</p>
            <p style="font-size:12px; color:#666; margin:0 0 4px;">${b.address ?? b.city ?? ''}</p>
            ${b.rating ? `<p style="font-size:12px; margin:0 0 6px;">★ ${b.rating} (${b.reviewCount ?? 0} recenzii)</p>` : ''}
            <a href="/${b.slug}" style="font-size:13px; color:#0c2c53;">Vezi profil →</a>
          </div>
        `)
        infoWindow.open(mapInstance.current, marker)
      })

      markersRef.current.push(marker)
    })
  }, [businesses, loaded])

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 lg:px-6 py-3 border-b flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('ALL')}
          className={`text-sm px-3 py-1.5 rounded-full border ${category === 'ALL' ? 'bg-gray-900 text-white' : ''}`}
        >
          Toate
        </button>
        <button
          onClick={() => setCategory('SALON')}
          className={`text-sm px-3 py-1.5 rounded-full border ${category === 'SALON' ? 'bg-gray-900 text-white' : ''}`}
        >
          Saloane
        </button>
        <button
          onClick={() => setCategory('EVENT_VENUE')}
          className={`text-sm px-3 py-1.5 rounded-full border ${category === 'EVENT_VENUE' ? 'bg-gray-900 text-white' : ''}`}
        >
          Spații evenimente
        </button>
        <span className="text-sm text-gray-500 ml-auto self-center">{businesses.length} afaceri</span>
      </div>

      <div className="relative flex-1">
        {!loaded && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Se încarcă harta...</div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center gap-4 text-sm text-gray-500 px-6 py-8 text-center overflow-y-auto">
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
        <div ref={mapRef} className="w-full h-full" style={{ display: loaded ? 'block' : 'none' }} />

        {loaded && (
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 flex gap-3 text-xs z-10">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#639922' }} />
              Salon
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#0c2c53' }} />
              Spații evenimente
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
