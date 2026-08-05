import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isIntervalBlocked } from '@/lib/availability'
import { z } from 'zod'

const schema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  staffId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
})

async function assertOwnership(id: string, businessId: string) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  return booking && booking.businessId === businessId ? booking : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (parsed.data.startAt) {
    const newStart = new Date(parsed.data.startAt)
    const newEnd = parsed.data.endAt ? new Date(parsed.data.endAt) : new Date(newStart.getTime() + (owned.endAt.getTime() - owned.startAt.getTime()))

    // blocăm doar dacă chiar se schimbă ORA (mutare) către trecut — nu blocăm actualizări
    // de status pe rezervări deja trecute (ex: marcarea ca "finalizată"/"neprezentare" după ce a avut loc)
    if (newStart < new Date()) {
      return NextResponse.json({ error: 'Nu poți muta o rezervare într-un interval din trecut.' }, { status: 400 })
    }

    if (await isIntervalBlocked(businessId, newStart, newEnd)) {
      return NextResponse.json({ error: 'Intervalul selectat este blocat pentru rezervări.' }, { status: 409 })
    }
  }

  const data: Record<string, any> = { ...parsed.data }
  if (data.startAt) data.startAt = new Date(data.startAt)
  if (data.endAt) data.endAt = new Date(data.endAt)

  await prisma.booking.update({ where: { id }, data })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // nu ștergem definitiv — anulăm, ca istoricul/statisticile să rămână corecte
  await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } })
  return NextResponse.json({ success: true })
}
