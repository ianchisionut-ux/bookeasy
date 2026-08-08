import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import CalendarClient from './calendar-client'

function computeMinMax(hours: { startTime: string; endTime: string }[], fallbackMin = '08:00', fallbackMax = '20:00') {
  if (hours.length === 0) return { minTime: fallbackMin, maxTime: fallbackMax }
  return {
    minTime: hours.reduce((min, wh) => (wh.startTime < min ? wh.startTime : min), hours[0].startTime),
    maxTime: hours.reduce((max, wh) => (wh.endTime > max ? wh.endTime : max), hours[0].endTime),
  }
}

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { workingHours: true },
  })

  const isMultiPractitioner = (business?.teamSize ?? 1) > 1

  const [bookings, blockedSlots, practitioners] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId, status: { not: 'CANCELLED' } },
      include: { customer: true, service: true, practitioner: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, include: { workingHours: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
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
    confirmationRequestSent: b.confirmationRequestSent,
    customerConfirmed: b.customerConfirmed,
  }))

  const { minTime, maxTime } = computeMinMax(business?.workingHours ?? [])

  return (
    <CalendarClient
      category={business?.category ?? 'SALON'}
      events={events}
      blockedSlots={blockedSlots.map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        reason: b.reason,
      }))}
      minTime={minTime}
      maxTime={maxTime}
      practitioners={practitioners.map((p) => {
        const range = computeMinMax(p.workingHours, minTime, maxTime)
        return { id: p.id, name: p.name, minTime: range.minTime, maxTime: range.maxTime }
      })}
    />
  )
}
