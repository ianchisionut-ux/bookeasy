import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import CalendarClient from './calendar-client'

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { staff: { where: { active: true }, orderBy: { name: 'asc' } }, workingHours: true },
  })

  const bookings = await prisma.booking.findMany({
    where: { businessId, status: { not: 'CANCELLED' } },
    include: { customer: true, service: true },
    orderBy: { startAt: 'asc' },
  })

  const blockedSlots = await prisma.blockedSlot.findMany({ where: { businessId } })

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

  // coloane per angajat doar dacă e afacere cu echipă reală (teamSize > 1) —
  // pentru afaceri individuale (teamSize 1) calendarul rămâne simplu, o singură coloană
  const resources =
    business?.category === 'SALON' && (business.teamSize ?? 1) > 1 && business.staff.length > 0
      ? business.staff.map((s) => ({ resourceId: s.id, resourceTitle: s.name }))
      : undefined

  const staffOptions = business?.staff.map((s) => ({ id: s.id, name: s.name })) ?? []

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
      resources={resources}
      staffOptions={staffOptions}
      blockedSlots={blockedSlots.map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        reason: b.reason,
      }))}
      minTime={minTime}
      maxTime={maxTime}
    />
  )
}
