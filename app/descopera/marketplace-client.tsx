'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ClientInstallBanner from '@/components/client-install-banner'
import './marketplace.css'
import { cityNearLocation } from '@/lib/client-location'
import { canonicalCity, normalizeCity } from '@/lib/romanian-cities'
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, Check, Heart, LayoutGrid, MapPin, Menu, Navigation, Search, Scissors, Star, Stethoscope, X } from 'lucide-react'

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
const preferredCityKey = 'bookeasy-client-preferred-city-v1'

export default function MarketplaceClient({ businesses }: { businesses: Business[] }) {
  const [category, setCategory] = useState<Category>('ALL')
  const [city, setCity] = useState('ALL')
  const [locating, setLocating] = useState(false)
  const cityChoiceRef = useRef(false)
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const resultsRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const cities = useMemo(() => [...new Set(businesses.map((business) => business.city && (canonicalCity(business.city) ?? business.city)).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ro')), [businesses])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
      if (Array.isArray(saved)) setFavorites(saved.filter((value): value is string => typeof value === 'string'))
    } catch { /* Device storage can be unavailable. */ }
    setReady(true)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(preferredCityKey)
      if (saved && (saved === 'ALL' || cities.includes(saved))) {
        cityChoiceRef.current = true
        setCity(saved)
        return
      }
    } catch { /* Device storage can be unavailable. */ }
    detectCity()
  // The available cities are fixed for this page load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  function detectCity() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearbyCity = cityNearLocation(position.coords.latitude, position.coords.longitude, cities)
        if (nearbyCity && !cityChoiceRef.current) setCity(nearbyCity)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }

  function chooseCity(value: string) {
    cityChoiceRef.current = true
    setCity(value)
    try { localStorage.setItem(preferredCityKey, value) } catch { /* Keep in-memory selection. */ }
  }

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [...favorites, slug]
    setFavorites(next)
    try { localStorage.setItem(favoritesKey, JSON.stringify(next)) } catch { /* Keep in-memory selection. */ }
  }

  function showResults() { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  function chooseCategory(value: Category) { setCategory(value); setFavoritesOnly(false); setMenuOpen(false); showResults() }
  function showFavorites() { setFavoritesOnly(true); setMenuOpen(false); showResults() }
  function startSearch() { setFavoritesOnly(false); searchRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  useEffect(() => {
    const navigate = (destination = window.location.hash) => {
      if (destination.endsWith('#favorite')) {
        setFavoritesOnly(true)
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (destination.endsWith('#cauta')) {
        setFavoritesOnly(false)
        searchRef.current?.focus()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (destination === '/descopera') {
        setCategory('ALL')
        setFavoritesOnly(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    const onHashChange = () => navigate()
    const onClientNav = (event: Event) => navigate((event as CustomEvent<string>).detail)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('bookeasy-client-nav', onClientNav)
    if (window.location.hash) navigate()
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('bookeasy-client-nav', onClientNav)
    }
  }, [])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ro-RO')
    return businesses.filter((business) =>
      (category === 'ALL' || business.category === category) &&
      (city === 'ALL' || (business.city && normalizeCity(business.city) === normalizeCity(city))) &&
      (!favoritesOnly || favorites.includes(business.slug)) &&
      (!normalized || [business.name, business.city, business.address].some((value) => value?.toLocaleLowerCase('ro-RO').includes(normalized)))
    )
  }, [businesses, category, city, favorites, favoritesOnly, query])

  const visibleGroups = useMemo(() => categories
    .filter((item) => item.value !== 'ALL')
    .map((item) => ({ ...item, businesses: visible.filter((business) => business.category === item.value) }))
    .filter((group) => group.businesses.length > 0), [visible])

  return (
    <main className="marketplace-page min-h-screen font-sans text-[var(--brand-ink)]">
      <header className="marketplace-header">
        <div className="marketplace-container flex h-[76px] items-center justify-between gap-4">
          <Link href="/descopera" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-teal-dark)]" aria-label="BookEasy — pagina principală">
            <Image src="/logo-mark-square.png" width={38} height={38} alt="" className="rounded-xl" />
            <span className="text-[21px] font-extrabold tracking-[-0.055em] text-[var(--brand-ink)]">bookeasy<span className="text-[var(--brand-teal-dark)]">.ro</span></span>
          </Link>

          <nav className="hidden items-center gap-1.5 lg:flex" aria-label="Navigare categorii">
            <button type="button" onClick={() => chooseCategory('SALON')} className={'marketplace-nav-link' + (category === 'SALON' && !favoritesOnly ? ' is-active' : '')}>Saloane</button>
            <button type="button" onClick={() => chooseCategory('CLINICA')} className={'marketplace-nav-link' + (category === 'CLINICA' && !favoritesOnly ? ' is-active' : '')}>Clinici</button>
            <button type="button" onClick={() => chooseCategory('EVENT_VENUE')} className={'marketplace-nav-link' + (category === 'EVENT_VENUE' && !favoritesOnly ? ' is-active' : '')}>Evenimente</button>
            <Link href="/harta" className="marketplace-nav-link">Explorează harta</Link>
          </nav>

          <div className="hidden items-center gap-4 sm:flex">
            <Link href="/dashboard" className="text-[13px] font-bold transition-colors hover:text-[var(--brand-teal-dark)] focus-visible:underline">Intră în cont</Link>
            <Link href="/pentru-afaceri#cere-acces" className="marketplace-header-cta inline-flex min-h-11 items-center gap-2 px-5 text-[13px] font-bold">
              Adaugă afacerea <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:hidden">
            <button type="button" aria-label="Caută" onClick={startSearch} className="marketplace-icon-button"><Search size={21} /></button>
            <button type="button" aria-label={menuOpen ? 'Închide meniul' : 'Deschide meniul'} aria-expanded={menuOpen} aria-controls="marketplace-mobile-menu" onClick={() => setMenuOpen(!menuOpen)} className="marketplace-icon-button">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="marketplace-mobile-menu" className="marketplace-mobile-menu sm:hidden" aria-label="Meniu mobil">
            {categories.filter((item) => item.value !== 'ALL').map((item) => (
              <button key={item.value} type="button" onClick={() => chooseCategory(item.value)} className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold hover:bg-[var(--brand-teal-soft)]"><item.icon size={18} />{item.label}</button>
            ))}
            <Link onClick={() => setMenuOpen(false)} href="/harta" className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold hover:bg-[var(--brand-teal-soft)]"><MapPin size={18} />Hartă</Link>
            <div className="my-2 border-t border-[var(--border-soft)]" />
            <Link onClick={() => setMenuOpen(false)} href="/dashboard" className="min-h-11 rounded-xl px-4 py-3 text-sm font-semibold">Intră în cont</Link>
            <Link onClick={() => setMenuOpen(false)} href="/pentru-afaceri#cere-acces" className="marketplace-header-cta mx-3 my-1 rounded-xl px-4 py-3 text-center text-sm font-bold">Adaugă afacerea ta</Link>
          </nav>
        )}
      </header>

      <section className="marketplace-hero" aria-labelledby="marketplace-hero-heading">
        <div className="marketplace-container marketplace-hero-inner">
          <div className="marketplace-hero-copy">
            <div className="marketplace-eyebrow"><span className="marketplace-eyebrow-dot" /> BOOKEASY · DESCOPERĂ ȘI REZERVĂ</div>
            <h1 id="marketplace-hero-heading" className="marketplace-headline">
              Locuri de descoperit.<br /><span>Momente de trăit.</span>
            </h1>
            <p className="marketplace-hero-description">Găsește saloane, clinici și spații de evenimente din orașul tău. Alegi ce ți se potrivește și rezervi direct, fără complicații.</p>
            <div className="marketplace-hero-perks" aria-label="Avantajele BookEasy">
              <span><Check size={16} aria-hidden="true" /> Alegi locul potrivit</span>
              <span><Check size={16} aria-hidden="true" /> Rezervi online</span>
            </div>
          </div>
          <div className="marketplace-showcase">
            <Image src="/client-marketplace-hero-v3.jpg" alt="Interfața BookEasy afișată pe laptop, tabletă și telefon" fill priority sizes="(max-width: 1023px) 100vw, 46vw" className="object-cover object-center" />
            <div className="marketplace-showcase-shade" />
            <div className="marketplace-showcase-label"><span className="marketplace-showcase-label-icon"><CalendarDays size={22} aria-hidden="true" /></span><span><strong>Totul într-un singur loc</strong><small>Descoperă. Alege. Rezervă.</small></span></div>
          </div>
        </div>
      </section>

      <section className="marketplace-container marketplace-search-section" aria-label="Caută locuri și experiențe">
        <form className="marketplace-search-card" onSubmit={(event) => { event.preventDefault(); setFavoritesOnly(false); showResults() }} role="search">
          <div className="marketplace-search-field">
            <div className="marketplace-search-icon"><MapPin size={21} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <label htmlFor="client-city" className="marketplace-field-label">ORAȘUL</label>
              <select id="client-city" value={city} onChange={(event) => chooseCity(event.target.value)} className="marketplace-input">
                <option value="ALL">Toate orașele</option>
                {cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { cityChoiceRef.current = false; try { localStorage.removeItem(preferredCityKey) } catch { /* Storage may be unavailable. */ } detectCity() }} disabled={locating} aria-label="Detectează orașul meu" title="Detectează orașul meu" className="marketplace-location-button">
              <Navigation size={19} aria-hidden="true" />
            </button>
          </div>

          <div className="marketplace-search-field marketplace-query-field">
            <div className="marketplace-search-icon"><Search size={22} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <label htmlFor="marketplace-query" className="marketplace-field-label">CE CAUȚI?</label>
              <input id="marketplace-query" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Salon, clinică, eveniment..." type="search" className="marketplace-input" />
            </div>
          </div>

          <button type="submit" className="marketplace-search-submit">Caută locuri <ArrowRight size={19} aria-hidden="true" /></button>
        </form>
      </section>

      <section className="marketplace-container marketplace-categories" aria-labelledby="marketplace-categories-heading">
        <div className="marketplace-section-intro">
          <div>
            <p className="marketplace-kicker">ALEGE CE ȚI SE POTRIVEȘTE</p>
            <h2 id="marketplace-categories-heading" className="marketplace-section-title">Ce vrei să descoperi?</h2>
          </div>
          <p className="marketplace-section-description">Explorează serviciile și locațiile disponibile.</p>
        </div>
        <div className="marketplace-category-grid">
          {categories.map((item) => {
            const selected = category === item.value && !favoritesOnly
            const description = item.value === 'ALL' ? 'Toate experiențele' : item.value === 'SALON' ? 'Frumusețe & îngrijire' : item.value === 'CLINICA' ? 'Sănătate & servicii' : 'Spații & locații'
            return (
              <button type="button" key={item.value} onClick={() => chooseCategory(item.value)} aria-pressed={selected} className={'marketplace-category-card' + (selected ? ' is-active' : '')}>
                <span className="marketplace-category-icon"><item.icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="marketplace-category-text"><strong>{item.label}</strong><small>{description}</small></span>
                <ArrowUpRight size={17} className="marketplace-category-arrow" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section ref={resultsRef} id="rezultate" className="marketplace-container marketplace-results" aria-labelledby="marketplace-results-title">
        <div className="marketplace-results-heading">
          <div>
            <p className="marketplace-kicker">LOCURI PENTRU TINE</p>
            <h2 id="marketplace-results-title" className="marketplace-section-title">
              {favoritesOnly ? 'Locurile tale favorite' : city === 'ALL' ? 'Descoperă pe BookEasy' : 'Recomandate în ' + city}
            </h2>
            <p className="marketplace-results-summary">{visible.length} {visible.length === 1 ? 'loc disponibil' : 'locuri disponibile'} {city === 'ALL' ? 'pe platformă' : 'în ' + city}</p>
          </div>
          <button type="button" onClick={() => { if (favoritesOnly) { setFavoritesOnly(false); showResults() } else { showFavorites() } }} aria-pressed={favoritesOnly} className={'marketplace-favorites-filter' + (favoritesOnly ? ' is-active' : '')}>
            <Heart size={17} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>Favorite{favorites.length ? ' (' + favorites.length + ')' : ''}</span>
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="marketplace-empty">
            <span className="marketplace-empty-icon"><Search size={27} aria-hidden="true" /></span>
            <h3>{businesses.length === 0 ? 'Locuri noi în curând' : favoritesOnly && favorites.length === 0 ? 'Nu ai încă locuri favorite' : 'Nu am găsit rezultate'}</h3>
            <p>{businesses.length === 0 ? 'Momentan nu sunt afaceri disponibile.' : favoritesOnly && favorites.length === 0 ? 'Salvează locurile preferate apăsând pe inimă.' : 'Încearcă alt oraș, o altă categorie sau o căutare mai generală.'}</p>
            {businesses.length > 0 && <button type="button" className="marketplace-reset-button" onClick={() => { setCategory('ALL'); chooseCity('ALL'); setQuery(''); setFavoritesOnly(false) }}>Vezi toate locurile <ArrowRight size={17} /></button>}
          </div>
        ) : (
          <div className="marketplace-groups">
            {visibleGroups.map((group) => (
              <section key={group.value} aria-labelledby={'category-' + group.value} className="marketplace-group">
                <div className="marketplace-group-heading">
                  <span className="marketplace-group-icon"><group.icon size={20} aria-hidden="true" /></span>
                  <h3 id={'category-' + group.value}>{group.label}</h3>
                  <span className="marketplace-group-count">{group.businesses.length} {group.businesses.length === 1 ? 'loc' : 'locuri'}</span>
                </div>
                <div className="marketplace-business-grid">
                  {group.businesses.map((business) => {
                    const isFavorite = ready && favorites.includes(business.slug)
                    return (
                      <article key={business.id} className="marketplace-business-card">
                        <div className="marketplace-business-image">
                          {business.heroImageUrl ? (
                            <Image src={business.heroImageUrl} alt={'Fotografie ' + business.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-cover" unoptimized={business.heroImageUrl.startsWith('/api/storage/public/')} />
                          ) : (
                            <div className="marketplace-business-placeholder" aria-hidden="true">{business.name.slice(0, 1).toLocaleUpperCase('ro-RO')}</div>
                          )}
                          <span className="marketplace-business-tag">{categoryLabels[business.category] || business.category}</span>
                          <button type="button" onClick={() => toggleFavorite(business.slug)} aria-label={isFavorite ? 'Elimină ' + business.name + ' din favorite' : 'Salvează ' + business.name + ' la favorite'} aria-pressed={isFavorite} className={'marketplace-favorite-heart' + (isFavorite ? ' is-active' : '')}>
                            <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="marketplace-business-body">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="marketplace-business-name">{business.name}</h4>
                            {business.rating !== null && Boolean(business.reviewCount) && <span className="marketplace-rating"><Star size={15} fill="currentColor" aria-hidden="true" />{business.rating.toFixed(1)}</span>}
                          </div>
                          <p className="marketplace-business-address"><MapPin size={16} className="shrink-0" aria-hidden="true" /><span>{business.city || business.address || 'România'}</span></p>
                          <div className="marketplace-business-actions">
                            <Link href={'/' + business.slug + '/rezerva'} className="marketplace-book-button">Rezervă acum <ArrowRight size={17} aria-hidden="true" /></Link>
                            <Link href={'/' + business.slug} className="marketplace-details-button">Detalii <ArrowUpRight size={15} aria-hidden="true" /></Link>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="marketplace-container marketplace-how-it-works" aria-labelledby="marketplace-how-title">
        <div className="marketplace-how-heading">
          <p className="marketplace-kicker">FĂRĂ COMPLICAȚII</p>
          <h2 id="marketplace-how-title" className="marketplace-section-title">De la căutare la rezervare</h2>
        </div>
        <div className="marketplace-steps">
          <div><span className="marketplace-step-number">01</span><strong>Descoperi</strong><p>Explorezi locurile și serviciile disponibile.</p></div>
          <div><span className="marketplace-step-number">02</span><strong>Alegi</strong><p>Găsești afacerea potrivită pentru tine.</p></div>
          <div><span className="marketplace-step-number">03</span><strong>Rezervi</strong><p>Faci rezervarea direct de pe telefon sau desktop.</p></div>
        </div>
      </section>
      <ClientInstallBanner />
    </main>
  )
}
