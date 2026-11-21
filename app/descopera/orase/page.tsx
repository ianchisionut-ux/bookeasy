import Link from 'next/link'
import { PublicFooter } from '@/components/ui/public-footer'
import { PublicHeader } from '@/components/ui/public-header'
import { PUBLIC_CITY_DIRECTORY_PATH, publicCityPath, romanianPublicCities } from '@/lib/public-marketplace'
import { publicMetadata } from '@/lib/seo'
import { listedMarketplaceCities } from '../listed-cities'

export const dynamic = 'force-dynamic'

const heading = 'Programari online in Romania'
const description = 'Cauta servicii dupa oras. Vezi unde sunt disponibile rezervari online la saloane, clinici si alte afaceri locale pe BookEasy.'
export const metadata = publicMetadata(`${heading} | BookEasy`, description, PUBLIC_CITY_DIRECTORY_PATH)

export default async function RomanianCitiesPage() {
  const availableCities = await listedMarketplaceCities()
  const cities = new Map(romanianPublicCities.map((city) => [city.slug, city]))
  const availableSlugs = new Set(availableCities.map(({ slug }) => slug))
  for (const city of availableCities) cities.set(city.slug, city)
  const cityGroups = new Map<string, typeof romanianPublicCities>()
  for (const city of [...cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'))) {
    const letter = city.name.charAt(0).toUpperCase()
    const group = cityGroups.get(letter)
    if (group) group.push(city)
    else cityGroups.set(letter, [city])
  }

  return (
    <div className="themed-static-bg min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">{description}</p>
        <section id="disponibile" className="mt-8 scroll-mt-6" aria-labelledby="available-cities-title">
          <h2 id="available-cities-title" className="text-xl font-semibold">Orase cu rezervari disponibile</h2>
          {availableCities.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {availableCities.map((city) => (
                <li key={city.slug}><Link href={publicCityPath(city.slug)} className="btn-primary inline-flex min-h-11 items-center px-4 text-sm">{city.name}</Link></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-gray-600">Mai multe afaceri vor fi disponibile in curand.</p>}
        </section>
        <section className="mt-10" aria-labelledby="all-cities-title">
          <h2 id="all-cities-title" className="text-xl font-semibold">Toate orasele din Romania</h2>
          <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Orase dupa initiala">
            {[...cityGroups.keys()].map((letter) => (
              <a key={letter} href={`#orase-${letter}`} className="flex size-11 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-white text-sm font-semibold hover:underline">{letter}</a>
            ))}
          </nav>
          {[...cityGroups].map(([letter, group]) => (
            <section key={letter} id={`orase-${letter}`} aria-labelledby={`litera-${letter}`} className="mt-6 scroll-mt-6">
              <h3 id={`litera-${letter}`} className="font-semibold">{letter}</h3>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.map((city) => (
                  <li key={city.slug}>
                    <Link href={publicCityPath(city.slug)} prefetch={false} className={`flex min-h-11 items-center break-words text-sm hover:underline${availableSlugs.has(city.slug) ? ' font-semibold text-[var(--brand-teal-dark)]' : ''}`}>{city.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
