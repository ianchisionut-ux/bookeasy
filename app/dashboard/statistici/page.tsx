import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { Card } from '@/components/ui/card'

export default async function StatisticiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [totalBookings, byChannel, byService] = await Promise.all([
    prisma.booking.count({ where: { businessId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.booking.groupBy({ by: ['channel'], where: { businessId, createdAt: { gte: thirtyDaysAgo } }, _count: true }),
    prisma.booking.groupBy({ by: ['serviceId'], where: { businessId, createdAt: { gte: thirtyDaysAgo } }, _count: true }),
  ])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-1">Statistici</h1>
      <p className="text-sm text-gray-500 mb-6">Ultimele 30 de zile</p>

      <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl">
        <Card>
          <p className="text-sm text-gray-500 mb-1">Total rezervări</p>
          <p className="text-3xl font-semibold">{totalBookings}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <Card>
          <h2 className="font-medium mb-3">Pe canal</h2>
          <ul className="text-sm flex flex-col gap-2">
            {byChannel.map((c) => (
              <li key={c.channel} className="flex justify-between">
                <span className="text-gray-500">{c.channel}</span>
                <span className="font-medium">{c._count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-medium mb-3">Pe serviciu</h2>
          <ul className="text-sm flex flex-col gap-2">
            {byService.map((s) => (
              <li key={s.serviceId} className="flex justify-between">
                <span className="text-gray-500 truncate">{s.serviceId}</span>
                <span className="font-medium">{s._count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
