import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CATEGORIES } from '@/lib/business-categories'

export const dynamic = 'force-dynamic'

const origin = 'https://bookeasy.ro'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businesses = await prisma.business.findMany({
    where: { publicListed: true, accountActive: true, category: { in: [...PUBLIC_CATEGORIES] } },
    select: { slug: true },
    orderBy: { slug: 'asc' },
    take: 45_000,
  })

  return [
    { url: origin, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/descopera`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${origin}/harta`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${origin}/pentru-afaceri`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/aplicatii`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${origin}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    ...businesses.map(({ slug }) => ({
      url: `${origin}/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
