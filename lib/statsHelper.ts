import { prisma } from './prisma'

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const // excludem CANCELLED din venit/trend

export async function getDailyStats(businessId: string, days = 30) {
  const d = Math.min(days || 30, 365)
  const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw<{ date: string; bookings: bigint; revenue: number }[]>`
    SELECT to_char(b."startAt", 'YYYY-MM-DD') AS date,
           COUNT(*) AS bookings,
           COALESCE(SUM(s.price), 0)::float AS revenue
    FROM "Booking" b
    JOIN "Service" s ON s.id = b."serviceId"
    WHERE b."businessId" = ${businessId}
      AND b."startAt" >= ${since}
      AND b.status != 'CANCELLED'
    GROUP BY date
    ORDER BY date ASC
  `
  return rows.map((r) => ({ date: r.date, bookings: Number(r.bookings), revenue: r.revenue }))
}

export async function getMonthlyStats(businessId: string, months = 12) {
  const m = Math.min(months || 12, 60)
  const since = new Date()
  since.setMonth(since.getMonth() - m)

  const rows = await prisma.$queryRaw<{ month: string; bookings: bigint; revenue: number }[]>`
    SELECT to_char(b."startAt", 'YYYY-MM') AS month,
           COUNT(*) AS bookings,
           COALESCE(SUM(s.price), 0)::float AS revenue
    FROM "Booking" b
    JOIN "Service" s ON s.id = b."serviceId"
    WHERE b."businessId" = ${businessId}
      AND b."startAt" >= ${since}
      AND b.status != 'CANCELLED'
    GROUP BY month
    ORDER BY month ASC
  `
  return rows.map((r) => ({ month: r.month, bookings: Number(r.bookings), revenue: r.revenue }))
}

const DOW_LABELS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

export async function getSummaryStats(businessId: string, from?: string, to?: string) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const toDate = to ? new Date(to) : new Date()
  toDate.setHours(23, 59, 59, 999)

  const bookings = await prisma.booking.findMany({
    where: { businessId, startAt: { gte: fromDate, lte: toDate } },
    include: { service: true, staff: true },
  })

  const active = bookings.filter((b) => b.status !== 'CANCELLED')
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED')
  const noShow = bookings.filter((b) => b.status === 'NO_SHOW')

  const revenue = active.reduce((sum, b) => sum + Number(b.service.price ?? 0), 0)
  const avgBookingValue = active.length > 0 ? revenue / active.length : 0

  // pe canal
  const byChannelMap = new Map<string, { count: number; revenue: number }>()
  active.forEach((b) => {
    const cur = byChannelMap.get(b.channel) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(b.service.price ?? 0)
    byChannelMap.set(b.channel, cur)
  })
  const byChannel = Array.from(byChannelMap.entries()).map(([channel, v]) => ({ channel, ...v }))

  // pe oră (0-23), utile pentru "ora de vârf" a rezervărilor
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  active.forEach((b) => {
    byHour[b.startAt.getHours()].count += 1
  })
  const peakHour = byHour.reduce((best, cur) => (cur.count > best.count ? cur : best), byHour[0])

  // pe zi a săptămânii
  const byDayOfWeek = Array.from({ length: 7 }, (_, dow) => ({ dow, label: DOW_LABELS[dow], count: 0 }))
  active.forEach((b) => {
    byDayOfWeek[b.startAt.getDay()].count += 1
  })
  const peakDayOfWeek = byDayOfWeek.reduce((best, cur) => (cur.count > best.count ? cur : best), byDayOfWeek[0])

  // top servicii
  const byServiceMap = new Map<string, { name: string; count: number; revenue: number }>()
  active.forEach((b) => {
    const cur = byServiceMap.get(b.serviceId) ?? { name: b.service.name, count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(b.service.price ?? 0)
    byServiceMap.set(b.serviceId, cur)
  })
  const topServices = Array.from(byServiceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // top angajați (relevant doar pentru saloane, gol pentru spații evenimente)
  const byStaffMap = new Map<string, { name: string; count: number }>()
  active.forEach((b) => {
    if (!b.staffId || !b.staff) return
    const cur = byStaffMap.get(b.staffId) ?? { name: b.staff.name, count: 0 }
    cur.count += 1
    byStaffMap.set(b.staffId, cur)
  })
  const topStaff = Array.from(byStaffMap.values()).sort((a, b) => b.count - a.count)

  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    totalBookings: active.length,
    revenue,
    avgBookingValue,
    cancelledCount: cancelled.length,
    cancellationRate: bookings.length > 0 ? cancelled.length / bookings.length : 0,
    noShowCount: noShow.length,
    byChannel,
    byHour,
    peakHour,
    byDayOfWeek,
    peakDayOfWeek,
    topServices,
    topStaff,
  }
}
