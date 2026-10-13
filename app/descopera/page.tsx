import { prisma } from '@/lib/prisma'
import MarketplaceClient from './marketplace-client'
import { PublicFooter } from '@/components/ui/public-footer'
import { PUBLIC_CATEGORIES } from '@/lib/business-categories'
import { SITE_URL, jsonLd } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const businesses = await prisma.business.findMany({
    where: { publicListed: true, accountActive: true, category: { in: [...PUBLIC_CATEGORIES] } },
    select: { id: true, slug: true, name: true, category: true, city: true, address: true, rating: true, reviewCount: true, heroImageUrl: true },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'BookEasy', url: SITE_URL, inLanguage: 'ro-RO' }) }} />
      <MarketplaceClient businesses={businesses.map((business) => ({
        ...business,
        rating: business.rating === null ? null : Number(business.rating),
      }))} />
      <PublicFooter />
    </>
  )
}
