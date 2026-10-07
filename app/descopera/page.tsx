import { prisma } from '@/lib/prisma'
import MarketplaceClient from './marketplace-client'
import { PublicFooter } from '@/components/ui/public-footer'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const businesses = await prisma.business.findMany({
    where: { publicListed: true, accountActive: true, category: { in: ['SALON', 'CLINICA', 'EVENT_VENUE'] } },
    select: { id: true, slug: true, name: true, category: true, city: true, address: true, rating: true, reviewCount: true, heroImageUrl: true },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <MarketplaceClient businesses={businesses.map((business) => ({
        ...business,
        rating: business.rating === null ? null : Number(business.rating),
      }))} />
      <PublicFooter />
    </>
  )
}
