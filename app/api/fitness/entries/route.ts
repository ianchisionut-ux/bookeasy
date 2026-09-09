import { prisma } from '@/lib/prisma'
import { failure, fitnessActor, input, json } from '@/lib/fitness-auth'
import { calendarDate, entryPlan } from '@/lib/fitness-validation'

export async function GET(req: Request) {
  try {
    const { client } = await fitnessActor(req)
    const url = new URL(req.url)
    const from = calendarDate.parse(url.searchParams.get('from'))
    const to = calendarDate.parse(url.searchParams.get('to'))
    if (to < from || Date.parse(to) - Date.parse(from) > 62 * 86400_000) return json({ error: 'Selectează maximum 62 de zile.' }, 400)
    const [entries, bookings] = await Promise.all([
      prisma.fitnessEntry.findMany({ where: { clientId: client.id, date: { gte: from, lte: to } }, orderBy: [{ date: 'asc' }, { time: 'asc' }], take: 1500 }),
      // Include UTC boundary days; the UI groups bookings in the business timezone.
      prisma.booking.findMany({ where: { businessId: client.businessId, customerId: client.customerId, startAt: { gte: new Date(Date.parse(from) - 86400_000), lt: new Date(Date.parse(to) + 2 * 86400_000) } },
        select: { id: true, startAt: true, endAt: true, status: true, service: { select: { name: true } } }, orderBy: { startAt: 'asc' }, take: 500 }),
    ])
    return json({ entries, bookings, clientName: client.customer.name, businessName: client.business.name, timezone: client.business.timezone })
  } catch (e) { return failure(e) }
}
export async function POST(req: Request) {
  try {
    const { client, owner } = await fitnessActor(req)
    if (!owner) return json({ error: 'Doar instructorul poate crea planuri.' }, 403)
    const plan = await input(req, entryPlan)
    return json(await prisma.fitnessEntry.create({ data: { ...plan, clientId: client.id } }), 201)
  } catch (e) { return failure(e) }
}
