import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CITY_DIRECTORY_PATH, publicCities, publicCityPath, publicMarketplaceWhere } from '@/lib/public-marketplace'
import { SITE_URL as origin } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businesses = await prisma.business.findMany({
    where: publicMarketplaceWhere,
    select: { slug: true, city: true },
    orderBy: { slug: 'asc' },
    take: 45_000,
  })

  const pages: MetadataRoute.Sitemap = [
    { url: `${origin}/descopera`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}${PUBLIC_CITY_DIRECTORY_PATH}`, changeFrequency: 'daily' },
    { url: `${origin}/harta`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${origin}/pentru-afaceri`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/contact`, changeFrequency: 'monthly', priority: 0.5 },
  ]
  return [
    ...pages,
    ...publicCities(businesses).slice(0, 50_000 - pages.length - businesses.length).map(({ slug }) => ({
      url: `${origin}${publicCityPath(slug)}`,
      changeFrequency: 'daily' as const,
    })),
    ...businesses.map(({ slug }) => ({
      url: `${origin}/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
