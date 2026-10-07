'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Heart, MapPin, Search, Star } from 'lucide-react'

type Category = 'ALL' | 'SALON' | 'CLINICA' | 'EVENT_VENUE'
type Business = {
  id: string
  slug: string
  name: string
  category: string
  city: string | null
  address: string | null
  rating: number | null
  reviewCount: number | null
  heroImageUrl: string | null
}

const categories: { value: Category; label: string }[] = [
  { value: 'ALL', label: 'Toate' },
  { value: 'SALON', label: 'Saloane' },
  { value: 'CLINICA', label: 'Clinici' },
  { value: 'EVENT_VENUE', label: 'Evenimente' },
]
const categoryLabels: Record<string, string> = {
  SALON: 'Salon', CLINICA: 'Clinică', EVENT_VENUE: 'Spațiu pentru evenimente',
}
const favoritesKey = 'bookeasy-client-favorites-v1'

export default function MarketplaceClient({ businesses }: { businesses: Business[] }) {
  const [category, setCategory] = useState<Category>('ALL')
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
      if (Array.isArray(saved)) setFavorites(saved.filter((value): value is string => typeof value === 'string'))
    } catch { /* Ignore old or malformed local preferences. */ }
    setReady(true)
  }, [])

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [...favorites, slug]
    setFavorites(next)
    try { localStorage.setItem(favoritesKey, JSON.stringify(next)) } catch { /* Private mode may prevent storage. */ }
  }

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ro-RO')
    return businesses.filter((business) =>
      (category === 'ALL' || business.category === category) &&
      (!favoritesOnly || favorites.includes(business.slug)) &&
      (!normalized || [business.name, business.city, business.address].some((value) => value?.toLocaleLowerCase('ro-RO').includes(normalized)))
    )
  }, [businesses, category, favorites, favoritesOnly, query])

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--brand-teal-dark)]">BookEasy pentru clienți</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--brand-ink)] sm:text-4xl">Unde vrei să rezervi?</h1>
        <p className="mt-2 text-sm text-gray-600">Alege o categorie, caută o afacere și rezervă direct. Salvează favoritele pentru data viitoare.</p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:p-4">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-white px-4 focus-within:ring-2 focus-within:ring-[var(--brand-teal-dark)]">
          <Search size={19} className="shrink-0 text-gray-500" />
          <span className="sr-only">Caută afacere sau oraș</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută salon, clinică sau oraș" className="w-full bg-transparent text-base outline-none placeholder:text-gray-400" type="search" />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrează categoria">
          {categories.map((item) => <button key={item.value} type="button" onClick={() => setCategory(item.value)} aria-pressed={category === item.value} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${category === item.value ? 'bg-[var(--brand-teal-dark)] text-white' : 'border border-[var(--border-soft)] bg-white text-gray-700'}`}>{item.label}</button>)}
          <button type="button" onClick={() => setFavoritesOnly(!favoritesOnly)} aria-pressed={favoritesOnly} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ${favoritesOnly ? 'bg-rose-600 text-white' : 'border border-[var(--border-soft)] bg-white text-gray-700'}`}><Heart size={16} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favorite</button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-sm text-gray-600"><span>{visible.length} {visible.length === 1 ? 'afacere' : 'afaceri'}</span><Link href="/harta" className="font-semibold text-[var(--brand-teal-dark)]">Vezi harta</Link></div>
      {visible.length === 0 ? <div className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-white p-8 text-center text-sm text-gray-600">{businesses.length === 0 ? 'Momentan nu sunt afaceri disponibile.' : favoritesOnly && favorites.length === 0 ? 'Nu ai salvat încă afaceri favorite.' : 'Nu am găsit afaceri pentru această căutare.'}</div> : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((business) => {
            const isFavorite = ready && favorites.includes(business.slug)
            return <article key={business.id} className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-white shadow-sm">
              <div className="relative h-36 bg-[var(--accent-soft)]">
                {business.heroImageUrl ? <Image src={business.heroImageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" unoptimized={business.heroImageUrl.startsWith('/api/storage/public/')} /> : <div className="grid h-full place-items-center text-3xl font-semibold text-[var(--brand-teal-dark)]">{business.name.slice(0, 1).toLocaleUpperCase('ro-RO')}</div>}
                <button type="button" onClick={() => toggleFavorite(business.slug)} aria-label={isFavorite ? `Elimină ${business.name} din favorite` : `Salvează ${business.name} la favorite`} aria-pressed={isFavorite} className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white text-rose-600 shadow"><Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} /></button>
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">{categoryLabels[business.category] || business.category}</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">{business.name}</h2>
                {(business.city || business.address) && <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600"><MapPin size={15} className="shrink-0" />{business.city || business.address}</p>}
                {business.rating !== null && business.reviewCount ? <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600"><Star size={15} fill="currentColor" className="text-amber-500" />{business.rating.toFixed(1)} · {business.reviewCount} recenzii</p> : null}
                <div className="mt-4 flex gap-2"><Link href={`/${business.slug}/rezerva`} className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 text-sm">Rezervă <ArrowRight size={16} /></Link><Link href={`/${business.slug}`} className="btn-secondary flex min-h-11 items-center justify-center px-3 text-sm">Detalii</Link></div>
              </div>
            </article>
          })}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-gray-500">Favoritele sunt salvate pe acest telefon.</p>
    </div>
  )
}
