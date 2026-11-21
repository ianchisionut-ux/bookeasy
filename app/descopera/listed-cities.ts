import { prisma } from '@/lib/prisma'
import { publicCities, publicMarketplaceWhere } from '@/lib/public-marketplace'

export async function listedMarketplaceCities() {
  const cities = await prisma.business.groupBy({
    by: ['city'],
    where: { ...publicMarketplaceWhere, city: { not: null } },
  })
  return publicCities(cities)
}
