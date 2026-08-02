import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import CalendarClient from './calendar-client'

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const bookings = await prisma.booking.findMany({
    where: { businessId },
    include: { customer: true, service: true },
    orderBy: { startAt: 'asc' },
  })

  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.customer.name ?? b.customer.phone} — ${b.service.name}`,
    start: b.startAt,
    end: b.endAt,
    status: b.status,
  }))

  return <CalendarClient events={events} />
}
