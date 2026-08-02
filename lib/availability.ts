import { prisma } from './prisma'
import { addMinutes, isWithinInterval } from 'date-fns'

export async function getAvailableSlots(businessId: string, serviceId: string, date: Date) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return []

  if (service.type === 'APPOINTMENT') {
    return getStaffSlots(businessId, service, date)
  }
  return getResourceAvailability(businessId, service, date)
}

async function getStaffSlots(businessId: string, service: { id: string; durationMin: number | null }, date: Date) {
  const weekday = date.getDay()
  const workingHours = await prisma.workingHours.findMany({ where: { businessId, weekday } })
  const staff = await prisma.staff.findMany({ where: { businessId, active: true } })
  const existingBookings = await prisma.booking.findMany({
    where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { gte: date } },
  })

  const duration = service.durationMin ?? 30
  const slots: string[] = []

  for (const wh of workingHours) {
    let cursor = combineDateAndTime(date, wh.startTime)
    const end = combineDateAndTime(date, wh.endTime)

    while (addMinutes(cursor, duration) <= end) {
      const slotEnd = addMinutes(cursor, duration)
      const isFree = staff.some(
        (s) =>
          !existingBookings.some(
            (b) => b.staffId === s.id && overlaps(cursor, slotEnd, b.startAt, b.endAt)
          )
      )
      if (isFree) slots.push(cursor.toISOString())
      cursor = addMinutes(cursor, 15) // granularitate sloturi
    }
  }

  return slots
}

async function getResourceAvailability(businessId: string, service: { id: string }, date: Date) {
  const resources = await prisma.resource.findMany({ where: { businessId } })
  const existingBookings = await prisma.booking.findMany({
    where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] } },
  })

  return resources
    .filter((r) => !existingBookings.some((b) => b.resourceId === r.id && sameDay(b.startAt, date)))
    .map((r) => r.id)
}

function combineDateAndTime(date: Date, time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}
