import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { syncBookingToGoogle } from '@/lib/google-calendar'

const schema = z.object({ token: z.string().uuid(), action: z.enum(['CONFIRM', 'RESCHEDULE', 'CANCEL']) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const input = schema.safeParse(await req.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'Link de confirmare invalid.' }, { status: 400 })
  const { id } = await params
  const booking = await prisma.booking.findUnique({ where: { id }, include: { business: { select: { slug: true } } } })
  if (!booking || booking.confirmationRequestToken !== input.data.token || !booking.confirmationRequestSent) return NextResponse.json({ error: 'Linkul nu mai este valabil.' }, { status: 404 })
  if (booking.startAt <= new Date()) return NextResponse.json({ error: 'Programarea a trecut deja.' }, { status: 409 })

  // Alegerea reprogramării deschide formularul, fără să elibereze încă ora veche.
  // Anularea se face numai după ce o nouă rezervare a fost creată cu succes.
  if (input.data.action === 'RESCHEDULE') {
    if (booking.customerConfirmed !== null || !['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return NextResponse.json({ error: 'Răspunsul pentru această programare a fost deja înregistrat.' }, { status: 409 })
    }
    return NextResponse.json({
      success: true,
      action: 'RESCHEDULE',
      rebookUrl: `/${booking.business.slug}/rezerva?rescheduleId=${encodeURIComponent(id)}&rescheduleToken=${encodeURIComponent(input.data.token)}`,
    })
  }

  const data = input.data.action === 'CONFIRM'
    ? { status: 'CONFIRMED' as const, customerConfirmed: true, confirmationSeenByAdmin: false }
    : { status: 'CANCELLED' as const, customerConfirmed: false, confirmationSeenByAdmin: false }
  const updated = await prisma.booking.updateMany({
    where: { id, confirmationRequestToken: input.data.token, confirmationRequestSent: true, customerConfirmed: null, status: { in: ['PENDING', 'CONFIRMED'] } },
    data,
  })
  if (!updated.count) return NextResponse.json({ error: 'Răspunsul pentru această programare a fost deja înregistrat.' }, { status: 409 })
  await syncBookingToGoogle(id).catch((error) => console.error('[google-calendar] sync SMS confirmation:', error))
  return NextResponse.json({ success: true, action: input.data.action })
}
