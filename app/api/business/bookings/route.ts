import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isIntervalBlocked } from '@/lib/availability'
import { getNextSequenceNumber } from '@/lib/booking-number'
import { z } from 'zod'

const schema = z
  .object({
    customerId: z.string().optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(6).optional(),
    serviceId: z.string(),
    staffId: z.string().nullable().optional(),
    resourceId: z.string().nullable().optional(),
    practitionerId: z.string().nullable().optional(),
    startAt: z.string(),
    endAt: z.string(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  })
  .refine((data) => data.customerId || (data.customerName && data.customerPhone), {
    message: 'Alege un client existent sau completează nume și telefon pentru unul nou.',
  })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const startDate = new Date(parsed.data.startAt)
  const endDate = new Date(parsed.data.endAt)

  if (startDate < new Date()) {
    return NextResponse.json({ error: 'Nu poți crea o rezervare într-un interval din trecut.' }, { status: 400 })
  }

  if (await isIntervalBlocked(businessId, startDate, endDate)) {
    return NextResponse.json({ error: 'Intervalul selectat este blocat pentru rezervări.' }, { status: 409 })
  }

  // client existent (ales din listă) sau creat/regăsit pe loc, după numărul de telefon —
  // ca administratorul să nu mai trebuiască să treacă prin /Clienti separat
  let customerId = parsed.data.customerId
  if (!customerId && parsed.data.customerPhone) {
    const existing = await prisma.customer.findFirst({ where: { businessId, phone: parsed.data.customerPhone } })
    if (existing) {
      customerId = existing.id
      if (parsed.data.customerName && !existing.name) {
        await prisma.customer.update({ where: { id: existing.id }, data: { name: parsed.data.customerName } })
      }
    } else {
      const created = await prisma.customer.create({
        data: { businessId, name: parsed.data.customerName, phone: parsed.data.customerPhone },
      })
      customerId = created.id
    }
  }

  const sequenceNumber = await getNextSequenceNumber(businessId, new Date())

  const booking = await prisma.booking.create({
    data: {
      businessId,
      customerId: customerId!,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      practitionerId: parsed.data.practitionerId ?? null,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      status: parsed.data.status ?? 'CONFIRMED',
      channel: 'MANUAL', // rezervare adăugată manual de admin din dashboard, nu de client prin bot
      sequenceNumber,
    },
  })

  return NextResponse.json({ booking })
}
