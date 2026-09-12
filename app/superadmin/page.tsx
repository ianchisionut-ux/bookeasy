import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Saloane',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hoteluri',
  PENSIUNE: 'Pensiuni',
  CLINICA: 'Clinici',
}

export default async function SuperAdminOverview() {
  const rows = await prisma.$queryRaw<Array<{
    totalBusinesses: bigint
    totalBookingsLast30d: bigint
    activeSubscriptions: bigint
    totalCustomers: bigint
    categoryCounts: Array<{ category: string; count: number }>
  }>>`
    SELECT
      (SELECT COUNT(*) FROM "Business") AS "totalBusinesses",
      (SELECT COUNT(*) FROM "Booking" WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS "totalBookingsLast30d",
      (SELECT COUNT(*) FROM "Subscription" WHERE status IN ('ACTIVE', 'TRIALING')) AS "activeSubscriptions",
      (SELECT COUNT(*) FROM "Customer") AS "totalCustomers",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('category', grouped.category, 'count', grouped.count))
        FROM (
          SELECT category::text AS category, COUNT(*)::int AS count
          FROM "Business"
          GROUP BY category
          ORDER BY category
        ) grouped
      ), '[]'::jsonb) AS "categoryCounts"
  `
  const overview = rows[0]
  const totalBusinesses = Number(overview?.totalBusinesses ?? 0)
  const totalBookingsLast30d = Number(overview?.totalBookingsLast30d ?? 0)
  const activeSubscriptions = Number(overview?.activeSubscriptions ?? 0)
  const totalCustomers = Number(overview?.totalCustomers ?? 0)
  const byCategory = overview?.categoryCounts ?? []

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-semibold mb-1">Prezentare generală</h1>
      <p className="text-sm text-gray-500 mb-6">Toate afacerile de pe platformă</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500 mb-1">Afaceri totale</p>
          <p className="text-3xl font-semibold">{totalBusinesses}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 mb-1">Abonamente active</p>
          <p className="text-3xl font-semibold">{activeSubscriptions}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 mb-1">Rezervări (30 zile)</p>
          <p className="text-3xl font-semibold">{totalBookingsLast30d}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 mb-1">Clienți finali totali</p>
          <p className="text-3xl font-semibold">{totalCustomers}</p>
        </Card>
      </div>

      <Card className="max-w-md">
        <h2 className="font-medium mb-3">Pe categorie</h2>
        <ul className="text-sm flex flex-col gap-2">
          {byCategory.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span className="text-gray-500">{CATEGORY_LABEL[c.category] ?? c.category}</span>
              <span className="font-medium">{c.count}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
