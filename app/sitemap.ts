import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PUBLIC_CATEGORIES } from '@/lib/business-categories'
import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businesses = await prisma.business.findMany({
    where: { publicListed: true, accountActive: true, category: { in: [...PUBLIC_CATEGORIES] } }, select: { slug: true }, orderBy: { slug: 'asc' },
  })
  return [
    ...['/descopera', '/harta', '/pentru-afaceri', '/legal', '/legal/termeni', '/legal/confidentialitate', '/legal/cookies', '/dpa'].map((path) => ({ url: `${SITE_URL}${path}` })),
    ...businesses.map((business) => ({ url: `${SITE_URL}/${encodeURIComponent(business.slug)}` })),
  ]
}
