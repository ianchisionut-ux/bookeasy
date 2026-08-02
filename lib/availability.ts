import { prisma } from './prisma'
import { addMinutes } from 'date-fns'

// bookeasy.ro funcționează cu o singură gestiune per salon (fără angajați multipli) —
// un slot ocupat blochează acea oră pentru toți clienții, nu doar pentru "cineva anume"
export async function getAvailableSlots(businessId: string, serviceId: string, date: Date) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return []

  if (service.type === 'APPOINTMENT') {
    return getSingleSlotAvailability(businessId, service, date)
  }
  return getResourceAvailability(businessId, service, date)
}

// intervalele blocate ale unei zile — folosite atât pentru filtrarea sloturilor
// oferite de bot, cât și pentru verificarea "ultima clipă" la confirmare
async function getBlockedSlotsForDay(businessId: string, date: Date) {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  return prisma.blockedSlot.findMany({
    where: { businessId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
  })
}

async function isRangeBlocked(businessId: string, start: Date, end: Date): Promise<boolean> {
  const blocked = await prisma.blockedSlot.findFirst({
    where: { businessId, startAt: { lt: end }, endAt: { gt: start } },
  })
  return !!blocked
}

// apelată la confirmarea finală a unei rezervări — verifică dacă intervalul exact
// mai e liber chiar în acel moment (nu mai alocă niciun "angajat", doar validează sloul)
export async function isSlotStillAvailable(businessId: string, serviceId: string, startAt: Date): Promise<boolean> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return false

  const duration = service.durationMin ?? 30
  const endAt = addMinutes(startAt, duration)

  if (await isRangeBlocked(businessId, startAt, endAt)) return false

  const conflict = await prisma.booking.findFirst({
    where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
  })
  return !conflict
}

// folosită de rutele API pentru rezervări manuale/mutări — verifică dacă un interval
// se suprapune cu vreun BlockedSlot al business-ului
export async function isIntervalBlocked(businessId: string, start: Date, end: Date): Promise<boolean> {
  return isRangeBlocked(businessId, start, end)
}

async function getSingleSlotAvailability(businessId: string, service: { id: string; durationMin: number | null }, date: Date) {
  const weekday = date.getDay()
  const workingHours = await prisma.workingHours.findMany({ where: { businessId, weekday } })
  const existingBookings = await prisma.booking.findMany({
    where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { gte: date } },
  })
  const blockedSlots = await getBlockedSlotsForDay(businessId, date)

  const duration = service.durationMin ?? 30
  const slots: string[] = []

  for (const wh of workingHours) {
    let cursor = combineDateAndTime(date, wh.startTime)
    const end = combineDateAndTime(date, wh.endTime)

    while (addMinutes(cursor, duration) <= end) {
      const slotEnd = addMinutes(cursor, duration)

      const blockedHere = blockedSlots.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const bookedHere = existingBookings.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))

      if (!blockedHere && !bookedHere) slots.push(cursor.toISOString())
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
  const blockedSlots = await getBlockedSlotsForDay(businessId, date)

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const wholeDayBlocked = blockedSlots.some((b) => b.startAt <= dayStart && b.endAt >= dayEnd)
  if (wholeDayBlocked) return []

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
