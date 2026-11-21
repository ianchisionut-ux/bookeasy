import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { publicCities, publicCityPath, publicMarketplaceWhere } from '@/lib/public-marketplace'
import { SITE_URL as origin } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businesses = await prisma.business.findMany({
    where: publicMarketplaceWhere,
    select: { slug: true, city: true },
    orderBy: { slug: 'asc' },
    take: 45_000,
  })

  return [
    { url: `${origin}/descopera`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/harta`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${origin}/pentru-afaceri`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    ...publicCities(businesses).slice(0, 49_996 - businesses.length).map(({ slug }) => ({
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
