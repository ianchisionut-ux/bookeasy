import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isIntervalBlocked } from '@/lib/availability'
import { getNextSequenceNumber } from '@/lib/booking-number'
import { z } from 'zod'

const schema = z.object({
  customerId: z.string(),
  serviceId: z.string(),
  staffId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
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
  if (await isIntervalBlocked(businessId, startDate, endDate)) {
    return NextResponse.json({ error: 'Intervalul selectat este blocat pentru rezervări.' }, { status: 409 })
  }

  const sequenceNumber = await getNextSequenceNumber(businessId, new Date())

  const booking = await prisma.booking.create({
    data: {
      businessId,
      customerId: parsed.data.customerId,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      status: parsed.data.status ?? 'CONFIRMED',
      channel: 'WHATSAPP', // rezervare adăugată manual din dashboard — canalul nu se aplică real, dar câmpul e obligatoriu
      sequenceNumber,
    },
  })

  return NextResponse.json({ booking })
}
