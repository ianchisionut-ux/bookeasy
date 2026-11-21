import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { ArrowRight, MapPin } from 'lucide-react'
import { PublicHeader } from '@/components/ui/public-header'
import { PublicFooter } from '@/components/ui/public-footer'
import { CATEGORY_LABEL } from '@/lib/business-categories'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CITY_DIRECTORY_PATH, publicCityPath, publicCitySlug, publicMarketplaceWhere, romanianPublicCities, withoutDiacritics } from '@/lib/public-marketplace'
import { citySeo, jsonLd, onlineBookingAction, publicMetadata, SITE_URL } from '@/lib/seo'
import { listedMarketplaceCities } from '../listed-cities'

export const dynamic = 'force-dynamic'

type CityPageProps = { params: Promise<{ oras: string }> }

function requestedSlug(value: string) {
  try {
    return publicCitySlug(decodeURIComponent(value))
  } catch {
    return ''
  }
}

const loadCity = cache(async (slug: string) => {
  if (!slug) return null
  const listed = (await listedMarketplaceCities()).find((item) => item.slug === slug)
  const city = listed ?? romanianPublicCities.find((item) => item.slug === slug)
  if (!city) return null

  const businesses = listed ? await prisma.business.findMany({
    where: { ...publicMarketplaceWhere, city: { in: [...listed.databaseNames] } },
    select: {
      id: true, name: true, slug: true, category: true, address: true,
      services: { where: { active: true }, select: { name: true }, orderBy: { name: 'asc' }, take: 3 },
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  }) : []
  const seo = businesses.length ? citySeo(city.name, businesses.map(({ category }) => category)) : {
    heading: `Servicii in ${city.name}`,
    description: `Momentan nu sunt afaceri cu programari online publicate in ${city.name}. Poti vedea serviciile disponibile in alte orase.`,
  }
  return { city, businesses, seo }
})

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const data = await loadCity(requestedSlug((await params).oras))
  if (!data) return { title: 'Oras indisponibil | BookEasy', robots: { index: false, follow: true } }
  const metadata = publicMetadata(`${data.seo.heading} | BookEasy`, data.seo.description, publicCityPath(data.city.slug))
  return data.businesses.length ? metadata : { ...metadata, robots: { index: false, follow: true } }
}

export default async function CityPage({ params }: CityPageProps) {
  const { oras } = await params
  const data = await loadCity(requestedSlug(oras))
  if (!data) notFound()
  const { city, businesses, seo } = data
  const path = publicCityPath(city.slug)
  if (oras !== city.slug) permanentRedirect(path)

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Orase din Romania', item: `${SITE_URL}${PUBLIC_CITY_DIRECTORY_PATH}` },
      { '@type': 'ListItem', position: 2, name: city.name, item: `${SITE_URL}${path}` },
    ],
  }

  return (
    <div className="themed-static-bg min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
        <nav aria-label="Locatia paginii" className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={PUBLIC_CITY_DIRECTORY_PATH} className="inline-flex min-h-11 items-center font-semibold text-[var(--brand-teal-dark)] hover:underline">Toate orasele</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{city.name}</span>
        </nav>
        <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{seo.heading}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">{seo.description}</p>

        {businesses.length ? <section aria-labelledby="city-businesses-heading" className="mt-8">
          <h2 id="city-businesses-heading" className="text-xl font-semibold sm:text-2xl">Afaceri in {city.name}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => {
              const businessPath = `/${encodeURIComponent(business.slug)}`
              return (
                <li key={business.id} className="card flex min-w-0 flex-col p-4 sm:p-5">
                  <p className="text-sm font-medium text-[var(--brand-teal-dark)]">{withoutDiacritics(CATEGORY_LABEL[business.category])}</p>
                  <h3 className="mt-1 break-words text-lg font-semibold"><Link href={businessPath} className="hover:underline">{business.name}</Link></h3>
                  <p className="mt-2 flex items-start gap-2 text-sm text-gray-600"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{business.address || city.name}</p>
                  {business.services.length > 0 && <p className="mt-2 break-words text-sm text-gray-600">{business.services.map(({ name }) => name).join(' · ')}</p>}
                  <div className="mt-auto pt-4">
                    <Link href={`${businessPath}/rezerva`} className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm">
                      {onlineBookingAction(business.category)} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section> : (
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`${PUBLIC_CITY_DIRECTORY_PATH}#disponibile`} className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm">Vezi orasele cu rezervari <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/pentru-afaceri#cere-acces" className="btn-secondary inline-flex min-h-11 items-center px-4 text-sm">Adauga o afacere in {city.name}</Link>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
