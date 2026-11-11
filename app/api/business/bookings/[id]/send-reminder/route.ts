import { NextResponse } from 'next/server'
import { auth } from '@/lib/business-auth'
import { prisma } from '@/lib/prisma'
import { sendAppointmentReminderSms } from '@/lib/appointment-reminder-sms'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  const session = await auth('STANDARD')
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const booking = await prisma.booking.findFirst({
    where: { id, businessId },
    include: { customer: true, service: true, business: true },
  })
  if (!booking) return NextResponse.json({ error: 'Programarea nu a fost găsită.' }, { status: 404 })
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) return NextResponse.json({ error: 'Programarea nu mai este activă.' }, { status: 409 })
  if (booking.startAt <= new Date()) return NextResponse.json({ error: 'Programarea este în trecut.' }, { status: 400 })
  const result = await sendAppointmentReminderSms(booking)
  if (!result.success) return NextResponse.json({ error: result.error || 'Gatewayul SMS nu este activ sau clientul nu are număr de telefon.' }, { status: 400 })
  return NextResponse.json(result, { status: result.status === 'SENT' ? 200 : 202 })
}
