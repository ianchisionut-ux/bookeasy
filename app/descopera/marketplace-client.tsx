'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ClientInstallBanner from '@/components/client-install-banner'
import './marketplace.css'
import { cityNearLocation } from '@/lib/client-location'
import { canonicalCity, normalizeCity } from '@/lib/romanian-cities'
import { CATEGORY_LABEL, PUBLIC_CATEGORY_GROUPS, type PublicCategory } from '@/lib/business-categories'
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, Heart, LayoutGrid, MapPin, Menu, Navigation, Search, Scissors, ShieldCheck, Star, Stethoscope, X } from 'lucide-react'

type Category = 'ALL' | PublicCategory
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
  { value: 'COAFURA_FRIZERIE', label: 'Coafură & frizerie', icon: Scissors },
  { value: 'BARBER_SHOP', label: 'Barber Shop', icon: Scissors },
  { value: 'NAILS', label: 'Unghii', icon: Star },
  { value: 'COSMETICA', label: 'Cosmetică & ten', icon: Star },
  { value: 'LASHES', label: 'Gene & sprâncene', icon: Star },
  { value: 'MAKE_UP', label: 'Make-up', icon: Star },
  { value: 'EPILARE', label: 'Epilare', icon: Star },
  { value: 'MASAJ', label: 'Masaj & terapii', icon: Heart },
  { value: 'SPA_WELLNESS', label: 'Spa & wellness', icon: Heart },
  { value: 'FITNESS', label: 'Fitness & personal training', icon: CalendarDays },
  { value: 'NUTRITIE_WELLNESS', label: 'Nutriție & wellness', icon: Heart },
  { value: 'ESTETICA_REMODELARE', label: 'Estetică & remodelare', icon: Star },
  { value: 'TATUAJE_PIERCING', label: 'Tatuaje & piercing', icon: Star },
  { value: 'MEDICAL_ESTETIC', label: 'Servicii medical-estetice', icon: Stethoscope },
  { value: 'SPORT_BAZE', label: 'Sport / Baze sportive', icon: CalendarDays },
  { value: 'MEDICAL', label: 'Medical', icon: Stethoscope },
  { value: 'CURSURI', label: 'Cursuri', icon: CalendarDays },
  { value: 'LOC_JOACA', label: 'Loc de joacă', icon: Heart },
  { value: 'ACCES_CLUB', label: 'Acces club', icon: Heart },
  { value: 'STUDIO_BEAUTY', label: 'Studio de beauty', icon: Scissors },
  { value: 'CLINICA', label: 'Clinici', icon: Stethoscope },
  { value: 'EVENT_VENUE', label: 'Evenimente', icon: Building2 },
] as const
const categoryLabels: Record<string, string> = CATEGORY_LABEL
const featuredCategories: PublicCategory[] = ['COAFURA_FRIZERIE', 'NAILS', 'MASAJ', 'SPA_WELLNESS', 'CLINICA', 'SALON', 'BARBER_SHOP', 'EVENT_VENUE']
type CategoryGroup = 'ALL' | typeof PUBLIC_CATEGORY_GROUPS[number]['id']
function groupForCategory(value: string): CategoryGroup {
  if (value === 'STUDIO_BEAUTY') return 'beauty'
  if (value === 'ACCES_CLUB') return 'sport'
  return PUBLIC_CATEGORY_GROUPS.find((group) => group.categories.some((item) => item === value))?.id ?? 'ALL'
}
function shortGroupLabel(label: string) {
  return label === 'Beauty & îngrijire' ? 'Beauty' : label === 'Relaxare & wellness' ? 'Wellness' : label === 'Sport & mișcare' ? 'Sport' : label
}
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
  const [activeGroup, setActiveGroup] = useState<CategoryGroup>('ALL')
  const [showAllCategories, setShowAllCategories] = useState(false)
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
  function chooseCategory(value: Category) { setCategory(value); setActiveGroup(value === 'ALL' ? 'ALL' : groupForCategory(value)); setFavoritesOnly(false); setMenuOpen(false); showResults() }
  function selectGroup(value: CategoryGroup) { setActiveGroup(value); setCategory('ALL'); setFavoritesOnly(false); setShowAllCategories(false) }
  function chooseGroup(value: CategoryGroup) { selectGroup(value); setMenuOpen(false); document.getElementById('categorii')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
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
      (activeGroup === 'ALL' || groupForCategory(business.category) === activeGroup) &&
      (category === 'ALL' || business.category === category || (category === 'SALON' && business.category === 'STUDIO_BEAUTY')) &&
      (city === 'ALL' || (business.city && normalizeCity(business.city) === normalizeCity(city))) &&
      (!favoritesOnly || favorites.includes(business.slug)) &&
      (!normalized || [business.name, business.city, business.address, CATEGORY_LABEL[business.category as keyof typeof CATEGORY_LABEL]].some((value) => value?.toLocaleLowerCase('ro-RO').includes(normalized)))
    )
  }, [activeGroup, businesses, category, city, favorites, favoritesOnly, query])

  const displayedCategories = (activeGroup === 'ALL'
    ? showAllCategories ? PUBLIC_CATEGORY_GROUPS.flatMap((group) => group.categories) : featuredCategories
    : PUBLIC_CATEGORY_GROUPS.find((group) => group.id === activeGroup)?.categories ?? []
  ).map((value) => categories.find((item) => item.value === value)!)
  const selectedGroup = PUBLIC_CATEGORY_GROUPS.find((group) => group.id === activeGroup)
  const resultsTitle = favoritesOnly ? 'Locurile tale favorite'
    : category !== 'ALL' ? `${CATEGORY_LABEL[category]}${city === 'ALL' ? '' : ' în ' + city}`
    : selectedGroup ? `${selectedGroup.label}${city === 'ALL' ? '' : ' în ' + city}`
    : city === 'ALL' ? 'Descoperă pe BookEasy' : 'Recomandate în ' + city

  return (
    <main className="marketplace-page min-h-screen font-sans text-[var(--brand-ink)]">
      <header className="marketplace-header">
        <div className="marketplace-container flex h-[76px] items-center justify-between gap-4">
          <Link href="/descopera" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-teal-dark)]" aria-label="BookEasy — pagina principală">
            <Image src="/logo-mark-square.png" width={38} height={38} alt="" className="rounded-xl" />
            <span className="text-[21px] font-extrabold tracking-[-0.055em] text-[var(--brand-ink)]">bookeasy<span className="text-[var(--brand-teal-dark)]">.ro</span></span>
          </Link>

          <nav className="hidden items-center gap-1.5 xl:flex" aria-label="Navigare principală">
            <a href="#rezultate" className="marketplace-nav-link">Afaceri</a>
            {PUBLIC_CATEGORY_GROUPS.map((group) => <button key={group.id} type="button" onClick={() => chooseGroup(group.id)} className="marketplace-nav-link">{shortGroupLabel(group.label)}</button>)}
            <Link href="/harta" className="marketplace-nav-link">Hartă</Link>
          </nav>

          <div className="hidden items-center gap-4 sm:flex">
            <Link href="/dashboard" className="marketplace-nav-link marketplace-login-link">Intră în cont</Link>
            <Link href="/pentru-afaceri#cere-acces" className="marketplace-header-cta inline-flex min-h-11 items-center gap-2 px-5 text-[13px] font-bold">
              Adaugă afacerea <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="flex items-center gap-1 xl:hidden">
            <button type="button" aria-label="Caută" onClick={startSearch} className="marketplace-icon-button"><Search size={21} /></button>
            <button type="button" aria-label={menuOpen ? 'Închide meniul' : 'Deschide meniul'} aria-expanded={menuOpen} aria-controls="marketplace-mobile-menu" onClick={() => setMenuOpen(!menuOpen)} className="marketplace-icon-button">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="marketplace-mobile-menu" className="marketplace-mobile-menu xl:hidden" aria-label="Meniu mobil">
            <a onClick={() => setMenuOpen(false)} href="#rezultate" className="flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold hover:bg-[var(--brand-teal-soft)]">Afaceri</a>
            {PUBLIC_CATEGORY_GROUPS.map((group) => <button key={group.id} type="button" onClick={() => chooseGroup(group.id)} className="min-h-11 rounded-xl px-4 text-left text-sm font-semibold hover:bg-[var(--brand-teal-soft)]">{group.label}</button>)}
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
            <h1 id="marketplace-hero-heading" className="marketplace-headline">
              Descoperă servicii locale. <span>Programează-te simplu.</span>
            </h1>
            <p className="marketplace-hero-description">Beauty, wellness, sănătate și experiențe în orașul tău.<br />Locuri de încredere. Rezervări online. Momente care contează.</p>
            <div className="marketplace-hero-benefits" aria-label="Avantaje BookEasy">
              <span><CalendarDays size={19} aria-hidden="true" />Rezervare rapidă</span>
              <span><ShieldCheck size={19} aria-hidden="true" />Afaceri locale</span>
              <span><Heart size={19} aria-hidden="true" />Totul într-un loc</span>
            </div>
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
              <label htmlFor="marketplace-query" className="marketplace-field-label">CE VREI SĂ DESCOPERI?</label>
              <input id="marketplace-query" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Saloane, masaj, clinică, eveniment..." type="search" className="marketplace-input" />
            </div>
          </div>

          <button type="submit" className="marketplace-search-submit">Descoperă servicii <ArrowRight size={19} aria-hidden="true" /></button>
        </form>
      </section>

      <section id="categorii" className="marketplace-container marketplace-categories" aria-labelledby="marketplace-categories-title">
        <div className="marketplace-categories-heading">
          <div>
            <p className="marketplace-kicker">EXPLOREAZĂ PRIN CATEGORII</p>
            <h2 id="marketplace-categories-title" className="marketplace-section-title">Ce vrei să descoperi?</h2>
          </div>
          <button type="button" onClick={() => { setShowAllCategories(!showAllCategories); setActiveGroup('ALL'); setCategory('ALL') }} className="marketplace-categories-toggle" aria-expanded={showAllCategories}>
            {showAllCategories ? 'Vezi mai puține' : 'Vezi toate categoriile'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="marketplace-category-groups" aria-label="Grupe de categorii">
          <button type="button" onClick={() => selectGroup('ALL')} aria-pressed={activeGroup === 'ALL'} className={'marketplace-category-group' + (activeGroup === 'ALL' ? ' is-active' : '')}>Recomandate</button>
          {PUBLIC_CATEGORY_GROUPS.map((group) => <button key={group.id} type="button" onClick={() => selectGroup(group.id)} aria-pressed={activeGroup === group.id} className={'marketplace-category-group' + (activeGroup === group.id ? ' is-active' : '')}>{group.label}</button>)}
        </div>
        <div className={'marketplace-category-cards' + (showAllCategories ? ' is-expanded' : '')}>
          {displayedCategories.map((item) => (
            <button key={item.value} type="button" onClick={() => chooseCategory(item.value)} className="marketplace-category-card">
              <span className="marketplace-category-image"><Image src={'/categories/' + item.value.toLowerCase() + '.webp'} alt="" fill sizes="(max-width: 640px) 44vw, 180px" /></span>
              <span className="marketplace-category-card-label">{item.label}<ArrowRight size={15} aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </section>

      <section ref={resultsRef} id="rezultate" className="marketplace-container marketplace-results" aria-labelledby="marketplace-results-title">
        <div className="marketplace-results-heading">
          <div>
            <h2 id="marketplace-results-title" className="marketplace-section-title">
              {resultsTitle}
            </h2>
            <p className="marketplace-results-summary">{visible.length} {visible.length === 1 ? 'loc disponibil' : 'locuri disponibile'} {city === 'ALL' ? 'pe platformă' : 'în ' + city}</p>
          </div>
          <button type="button" onClick={() => { if (favoritesOnly) { setFavoritesOnly(false); showResults() } else { showFavorites() } }} aria-pressed={favoritesOnly} className={'marketplace-favorites-filter' + (favoritesOnly ? ' is-active' : '')}>
            <Heart size={17} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>Favorite{favorites.length ? ' (' + favorites.length + ')' : ''}</span>
          </button>
        </div>

        <div className="marketplace-filter-bar" aria-label="Filtrează afacerile">
          <span className="marketplace-filter-label">Afaceri</span>
          <button type="button" onClick={() => selectGroup('ALL')} aria-pressed={activeGroup === 'ALL' && category === 'ALL' && !favoritesOnly}
            className={'marketplace-filter-chip' + (activeGroup === 'ALL' && category === 'ALL' && !favoritesOnly ? ' is-active' : '')}>Toate</button>
          {PUBLIC_CATEGORY_GROUPS.map((group) => (
            <button key={group.id} type="button" onClick={() => selectGroup(group.id)} aria-pressed={activeGroup === group.id && category === 'ALL' && !favoritesOnly}
              className={'marketplace-filter-chip' + (activeGroup === group.id && category === 'ALL' && !favoritesOnly ? ' is-active' : '')}>{shortGroupLabel(group.label)}</button>
          ))}
          <select aria-label="Subcategorie" className={'marketplace-filter-select' + (category !== 'ALL' && !favoritesOnly ? ' is-active' : '')}
            value={category === 'ALL' ? '' : category}
            onChange={(event) => event.target.value ? chooseCategory(event.target.value as Category) : setCategory('ALL')}>
            <option value="">Subcategorie</option>
            {PUBLIC_CATEGORY_GROUPS.filter((group) => activeGroup === 'ALL' || group.id === activeGroup).map((group) => <optgroup key={group.id} label={group.label}>
              {group.categories.map((value) => <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>)}
            </optgroup>)}
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="marketplace-empty">
            <span className="marketplace-empty-icon"><Search size={27} aria-hidden="true" /></span>
            <h3>{businesses.length === 0 ? 'Locuri noi în curând' : favoritesOnly && favorites.length === 0 ? 'Nu ai încă locuri favorite' : 'Nu am găsit rezultate'}</h3>
            <p>{businesses.length === 0 ? 'Momentan nu sunt afaceri disponibile.' : favoritesOnly && favorites.length === 0 ? 'Salvează locurile preferate apăsând pe inimă.' : 'Încearcă alt oraș, o altă categorie sau o căutare mai generală.'}</p>
            {businesses.length > 0 && <button type="button" className="marketplace-reset-button" onClick={() => { selectGroup('ALL'); chooseCity('ALL'); setQuery('') }}>Vezi toate locurile <ArrowRight size={17} /></button>}
          </div>
        ) : (
          <div className="marketplace-business-grid">
                  {visible.map((business) => {
                    const isFavorite = ready && favorites.includes(business.slug)
                    return (
                      <article key={business.id} className="marketplace-business-card">
                        <Link href={'/' + business.slug} className="marketplace-business-card-link" aria-label={'Vezi afacerea ' + business.name} />
                        <div className="marketplace-business-image">
                          {business.heroImageUrl ? (
                            <Image src={business.heroImageUrl} alt={'Fotografie ' + business.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 25vw" className="object-cover" unoptimized={business.heroImageUrl.startsWith('/api/storage/public/')} />
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
