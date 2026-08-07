import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import CalendarClient from './calendar-client'

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { workingHours: true },
  })

  const isClinic = business?.category === 'CLINICA'

  const [bookings, blockedSlots, practitioners] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId, status: { not: 'CANCELLED' } },
      include: { customer: true, service: true, practitioner: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
    isClinic ? prisma.practitioner.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ])

  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.customer.name ?? b.customer.phone} — ${b.service.name}${b.practitioner ? ` (${b.practitioner.name})` : ''}`,
    start: b.startAt,
    end: b.endAt,
    status: b.status,
    customerId: b.customerId,
    customerName: b.customer.name ?? b.customer.phone,
    customerPhone: b.customer.phone,
    serviceName: b.service.name,
    practitionerId: b.practitionerId,
    practitionerName: b.practitioner?.name ?? null,
  }))

  // intervalul orar afișat în calendar respectă programul real de lucru — cel mai
  // devreme început și cel mai târziu sfârșit din toate zilele configurate
  let minTime = '08:00'
  let maxTime = '20:00'
  if (business?.workingHours.length) {
    minTime = business.workingHours.reduce((min, wh) => (wh.startTime < min ? wh.startTime : min), business.workingHours[0].startTime)
    maxTime = business.workingHours.reduce((max, wh) => (wh.endTime > max ? wh.endTime : max), business.workingHours[0].endTime)
  }

  return (
    <CalendarClient
      events={events}
      blockedSlots={blockedSlots.map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        reason: b.reason,
      }))}
      minTime={minTime}
      maxTime={maxTime}
      practitioners={practitioners.map((p) => ({ id: p.id, name: p.name }))}
    />
  )
}
