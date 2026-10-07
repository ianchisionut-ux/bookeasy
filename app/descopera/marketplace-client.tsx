'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Building2, Heart, LayoutGrid, MapPin, Menu, Search, Scissors, Smartphone, Star, Stethoscope, X } from 'lucide-react'

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

const categories = [
  { value: 'ALL', label: 'Toate', icon: LayoutGrid },
  { value: 'SALON', label: 'Saloane', icon: Scissors },
  { value: 'CLINICA', label: 'Clinici', icon: Stethoscope },
  { value: 'EVENT_VENUE', label: 'Evenimente', icon: Building2 },
] as const
const categoryLabels: Record<string, string> = { SALON: 'Salon', CLINICA: 'Clinică', EVENT_VENUE: 'Evenimente' }
const favoritesKey = 'bookeasy-client-favorites-v1'

export default function MarketplaceClient({ businesses }: { businesses: Business[] }) {
  const [category, setCategory] = useState<Category>('ALL')
  const [city, setCity] = useState('ALL')
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const resultsRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const cities = useMemo(() => [...new Set(businesses.map((business) => business.city).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ro')), [businesses])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
      if (Array.isArray(saved)) setFavorites(saved.filter((value): value is string => typeof value === 'string'))
    } catch { /* Device storage can be unavailable. */ }
    setReady(true)
  }, [])

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [...favorites, slug]
    setFavorites(next)
    try { localStorage.setItem(favoritesKey, JSON.stringify(next)) } catch { /* Keep in-memory selection. */ }
  }

  function showResults() { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  function chooseCategory(value: Category) { setCategory(value); setFavoritesOnly(false); setMenuOpen(false); showResults() }
  function showFavorites() { setFavoritesOnly(true); setMenuOpen(false); showResults() }
  function startSearch() { setFavoritesOnly(false); searchRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ro-RO')
    return businesses.filter((business) =>
      (category === 'ALL' || business.category === category) &&
      (city === 'ALL' || business.city === city) &&
      (!favoritesOnly || favorites.includes(business.slug)) &&
      (!normalized || [business.name, business.city, business.address].some((value) => value?.toLocaleLowerCase('ro-RO').includes(normalized)))
    )
  }, [businesses, category, city, favorites, favoritesOnly, query])

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] pb-20 font-sans text-[var(--brand-ink)] md:pb-0">
      <header className="relative z-30 border-b border-[var(--border-soft)] bg-white">
        <div className="mx-auto flex h-[66px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/descopera" className="flex min-w-0 items-center gap-2" aria-label="BookEasy — acasă">
            <Image src="/logo-mark-square.png" width={34} height={34} alt="" className="rounded-lg" /><span className="text-xl font-bold tracking-tight text-[var(--brand-ink)]">bookeasy<span className="text-[var(--brand-teal-dark)]">.ro</span></span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium lg:flex" aria-label="Categorii">
            <button onClick={() => chooseCategory('SALON')} className="hover:text-[var(--brand-teal-dark)]">Saloane</button>
            <button onClick={() => chooseCategory('CLINICA')} className="hover:text-[var(--brand-teal-dark)]">Clinici</button>
            <button onClick={() => chooseCategory('EVENT_VENUE')} className="hover:text-[var(--brand-teal-dark)]">Evenimente</button>
            <Link href="/harta" className="hover:text-[var(--brand-teal-dark)]">Hartă</Link>
          </nav>
          <div className="hidden items-center gap-3 sm:flex"><Link href="/dashboard" className="text-sm font-medium hover:text-[var(--brand-teal-dark)]">Intră în cont</Link><Link href="/pentru-afaceri#cere-acces" className="btn-primary inline-flex min-h-11 items-center justify-center px-4">Adaugă afacerea ta</Link></div>
          <div className="flex items-center gap-1 sm:hidden"><button aria-label="Caută" onClick={startSearch} className="grid h-11 w-11 place-items-center"><Search size={22} /></button><button aria-label={menuOpen ? 'Închide meniul' : 'Deschide meniul'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="grid h-11 w-11 place-items-center">{menuOpen ? <X size={23} /> : <Menu size={23} />}</button></div>
        </div>
        {menuOpen && <nav className="absolute inset-x-0 top-full border-b border-[var(--border-soft)] bg-white p-4 shadow-lg sm:hidden" aria-label="Meniu mobil"><div className="grid gap-2 text-sm font-medium"><Link onClick={() => setMenuOpen(false)} href="/harta" className="rounded-xl p-3 hover:bg-[var(--brand-teal-soft)]">Hartă</Link><Link onClick={() => setMenuOpen(false)} href="/dashboard" className="rounded-xl p-3 hover:bg-[var(--brand-teal-soft)]">Intră în cont</Link><Link onClick={() => setMenuOpen(false)} href="/pentru-afaceri#cere-acces" className="rounded-xl p-3 hover:bg-[var(--brand-teal-soft)]">Adaugă afacerea ta</Link></div></nav>}
      </header>

      <section className="relative isolate h-[310px] overflow-hidden bg-[var(--brand-ink)] sm:h-[350px] lg:h-[390px]">
        <Image src="/client-marketplace-hero-v2.jpg" alt="Instrumente de salon și clinică, alături de un calendar de programări" fill priority sizes="100vw" className="object-cover object-[66%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-ink)]/95 via-[var(--brand-ink)]/70 to-[var(--brand-ink)]/20" />
        <div className="relative mx-auto flex h-full max-w-7xl items-center px-5 pb-8 sm:px-8 lg:pb-10">
          <div className="max-w-2xl text-white"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Rezervă simplu, oriunde</p><h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[56px]">Descoperă locuri<br />și experiențe<br /><span className="text-[var(--brand-teal)]">în orașul tău</span></h1><p className="mt-4 max-w-lg text-sm leading-relaxed text-white/90 sm:text-base">Saloane, clinici și spații de evenimente. Alegi locul potrivit și rezervi direct.</p></div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-2 rounded-[22px] border border-[var(--border-soft)] bg-white p-3 shadow-[0_12px_32px_rgba(17,38,58,.12)] sm:grid-cols-[180px_minmax(0,1fr)_140px] sm:items-center sm:gap-3 sm:p-4">
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border-soft)] px-3"><MapPin size={19} className="shrink-0 text-[var(--brand-teal-dark)]" /><span className="sr-only">Oraș</span><select value={city} onChange={(event) => setCity(event.target.value)} className="w-full bg-transparent text-sm font-medium outline-none"><option value="ALL">Toate orașele</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border-soft)] px-3"><Search size={19} className="shrink-0 text-[var(--brand-teal-dark)]" /><span className="sr-only">Caută</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') showResults() }} placeholder="Caută salon, clinică sau oraș..." type="search" className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400" /></label>
          <button onClick={showResults} className="btn-primary min-h-12 px-7 text-base">Caută</button>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-5" aria-label="Alege categoria">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{categories.map((item) => <button key={item.value} onClick={() => chooseCategory(item.value)} aria-pressed={category === item.value && !favoritesOnly} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border text-sm shadow-sm transition hover:-translate-y-0.5 sm:min-h-24 ${category === item.value && !favoritesOnly ? 'border-[var(--brand-teal)] bg-[var(--brand-teal-soft)] font-semibold text-[var(--brand-teal-dark)]' : 'border-[var(--border-soft)] bg-white text-[var(--brand-ink)]'}`}><item.icon size={23} /><span>{item.label}</span></button>)}</div>
      </section>

      <section ref={resultsRef} className="mx-auto max-w-7xl scroll-mt-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal-dark)]">Alege locul potrivit</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{favoritesOnly ? 'Locurile tale favorite' : city === 'ALL' ? 'Descoperă pe BookEasy' : `Recomandate în ${city}`}</h2></div><span className="text-sm text-gray-500">{visible.length} {visible.length === 1 ? 'loc' : 'locuri'}</span></div>
        {visible.length === 0 ? <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-9 text-center text-sm text-gray-600">{businesses.length === 0 ? 'Momentan nu sunt afaceri disponibile.' : favoritesOnly && favorites.length === 0 ? 'Nu ai salvat încă locuri favorite.' : 'Nu am găsit locuri pentru această căutare.'}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visible.map((business) => {
          const isFavorite = ready && favorites.includes(business.slug)
          return <article key={business.id} className="card card-interactive overflow-hidden transition hover:-translate-y-0.5"><div className="relative h-44 bg-[var(--brand-teal-soft)] sm:h-40">{business.heroImageUrl ? <Image src={business.heroImageUrl} alt="" fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw" className="object-cover" unoptimized={business.heroImageUrl.startsWith('/api/storage/public/')} /> : <div className="grid h-full place-items-center bg-gradient-to-br from-[var(--brand-teal-soft)] to-[var(--brand-green-soft)] text-4xl font-bold text-[var(--brand-teal-dark)]">{business.name.slice(0, 1).toLocaleUpperCase('ro-RO')}</div>}<span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-[var(--brand-teal-dark)]">{categoryLabels[business.category] || business.category}</span><button type="button" onClick={() => toggleFavorite(business.slug)} aria-label={isFavorite ? `Elimină ${business.name} din favorite` : `Salvează ${business.name} la favorite`} aria-pressed={isFavorite} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-[var(--brand-teal-dark)] shadow"><Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} /></button></div><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold leading-tight">{business.name}</h3>{business.rating !== null && business.reviewCount ? <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[#db8e00]"><Star size={15} fill="currentColor" />{business.rating.toFixed(1)}</span> : null}</div><p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13} />{business.city || business.address || 'România'}</p><div className="mt-4 flex gap-2"><Link href={`/${business.slug}/rezerva`} className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-1 px-3 text-sm">Rezervă <ArrowRight size={15} /></Link><Link href={`/${business.slug}`} className="btn-secondary flex min-h-11 items-center justify-center px-3 text-sm">Detalii</Link></div></div></article>
        })}</div>}
      </section>

      <section className="mx-auto mb-10 max-w-7xl px-4 sm:px-6"><div className="flex flex-col items-start gap-5 overflow-hidden rounded-[24px] bg-gradient-to-r from-[var(--brand-teal-soft)] to-[var(--brand-green-soft)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div><h2 className="text-2xl font-bold tracking-tight">BookEasy în buzunarul tău</h2><p className="mt-1 text-sm text-gray-600">Instalează aplicația pentru clienți și revino rapid la locurile favorite.</p><div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-[var(--brand-teal-dark)]"><span>♡ Favorite pe telefon</span><span>▣ Rezervare rapidă</span><span>✓ Fără magazin de aplicații</span></div></div><button onClick={() => window.dispatchEvent(new Event('bookeasy-install-request'))} className="btn-primary flex min-h-12 items-center gap-2 px-5 text-sm"><Smartphone size={19} /> Instalează aplicația</button></div></section>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--border-soft)] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(17,38,58,.07)] md:hidden" aria-label="Navigare aplicație client"><button onClick={() => { setCategory('ALL'); setFavoritesOnly(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-[var(--brand-teal-dark)]"><LayoutGrid size={21} />Acasă</button><button onClick={startSearch} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]"><Search size={21} />Caută</button><button onClick={showFavorites} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]"><Heart size={21} fill={favoritesOnly ? 'currentColor' : 'none'} />Favorite</button><Link href="/harta" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]"><MapPin size={21} />Hartă</Link></nav>
    </main>
  )
}
