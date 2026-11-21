import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import MarketplaceClient from './marketplace-client'
import { PublicFooter } from '@/components/ui/public-footer'
import { publicCities, publicCityPath, publicMarketplaceWhere } from '@/lib/public-marketplace'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const businesses = await prisma.business.findMany({
    where: publicMarketplaceWhere,
    select: { id: true, slug: true, name: true, category: true, city: true, address: true, rating: true, reviewCount: true, heroImageUrl: true },
    orderBy: { name: 'asc' },
  })
  const cities = publicCities(businesses)

  return (
    <>
      <MarketplaceClient businesses={businesses.map((business) => ({
        ...business,
        rating: business.rating === null ? null : Number(business.rating),
      }))}>
        {cities.length > 0 && (
          <section id="orase" className="marketplace-container mt-10" aria-labelledby="marketplace-cities-title">
            <h2 id="marketplace-cities-title" className="marketplace-section-title">Programari online pe orase</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {cities.map((city) => (
                <li key={city.slug}>
                  <Link href={publicCityPath(city.slug)} className="btn-secondary inline-flex min-h-11 items-center px-4 text-sm">
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </MarketplaceClient>
      <PublicFooter />
    </>
  )
}
