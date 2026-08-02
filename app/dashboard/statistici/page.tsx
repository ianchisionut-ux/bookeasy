import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export default async function StatisticiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [totalBookings, byChannel, byService] = await Promise.all([
    prisma.booking.count({ where: { businessId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.booking.groupBy({
      by: ['channel'],
      where: { businessId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ['serviceId'],
      where: { businessId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
  ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Statistici (ultimele 30 zile)</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total rezervări</p>
          <p className="text-2xl font-medium">{totalBookings}</p>
        </div>
      </div>

      <h2 className="text-lg font-medium mb-2">Pe canal</h2>
      <ul className="text-sm mb-6">
        {byChannel.map((c) => (
          <li key={c.channel}>
            {c.channel}: {c._count}
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-medium mb-2">Pe serviciu</h2>
      <ul className="text-sm">
        {byService.map((s) => (
          <li key={s.serviceId}>
            {s.serviceId}: {s._count}
          </li>
        ))}
      </ul>
    </div>
  )
}
