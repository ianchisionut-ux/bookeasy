import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import CalendarClient from './calendar-client'

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { staff: { where: { active: true }, orderBy: { name: 'asc' } } },
  })

  const bookings = await prisma.booking.findMany({
    where: { businessId, status: { not: 'CANCELLED' } },
    include: { customer: true, service: true },
    orderBy: { startAt: 'asc' },
  })

  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.customer.name ?? b.customer.phone} — ${b.service.name}`,
    start: b.startAt,
    end: b.endAt,
    status: b.status,
    resourceId: b.staffId ?? undefined,
    customerName: b.customer.name ?? b.customer.phone,
    serviceName: b.service.name,
    staffId: b.staffId,
  }))

  const resources =
    business?.category === 'SALON' && business.staff.length > 0
      ? business.staff.map((s) => ({ resourceId: s.id, resourceTitle: s.name }))
      : undefined

  const staffOptions = business?.staff.map((s) => ({ id: s.id, name: s.name })) ?? []

  return <CalendarClient events={events} resources={resources} staffOptions={staffOptions} />
}
