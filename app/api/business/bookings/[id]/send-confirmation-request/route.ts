import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/business-auth'
import { sendConfirmationRequest } from '@/lib/confirmation-request'
import crypto from 'crypto'
import { sendMessengerReconfirmation } from '@/lib/messenger-reconfirmation'
import { smsJobMessage } from '@/lib/sms-job-status'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth('STANDARD')
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  const input = await req.json().catch(() => ({})) as { channel?: string }
  if (input.channel && !['SMS', 'FACEBOOK', 'INSTAGRAM'].includes(input.channel)) return NextResponse.json({ error: 'Canal invalid.' }, { status: 400 })
  const social = input.channel === 'FACEBOOK' || input.channel === 'INSTAGRAM'

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true, service: true, business: true },
  })

  if (!booking || booking.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (input.channel === 'INSTAGRAM' && booking.channel !== 'INSTAGRAM') return NextResponse.json({ error: 'Programarea nu provine de pe Instagram.' }, { status: 400 })
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) return NextResponse.json({ error: 'Programarea nu mai este activă.' }, { status: 409 })
  if (booking.startAt <= new Date()) return NextResponse.json({ error: 'Programarea este în trecut.' }, { status: 400 })
  if (booking.customerConfirmed === true) return NextResponse.json({ error: 'Clientul a confirmat deja această programare.' }, { status: 409 })
  if (input.channel === 'FACEBOOK' && !booking.business.messengerReconfirmationEnabled) return NextResponse.json({ error: 'Reconfirmarea pe Messenger este dezactivată în Setări.' }, { status: 409 })
  if (!social && !booking.business.smsReconfirmationEnabled) return NextResponse.json({ error: 'Reconfirmarea prin SMS este dezactivată în Setări.' }, { status: 409 })

  if (!social && booking.confirmationRequestToken) {
    const pending = await prisma.smsJob.findUnique({ where: { businessId_idempotencyKey: { businessId, idempotencyKey: `confirm-${booking.id}-${booking.confirmationRequestToken}` } }, select: { id: true, status: true } })
    if (pending && ['PENDING', 'DISPATCHED'].includes(pending.status)) return NextResponse.json({ success: true, channel: 'SMS', jobId: pending.id, status: pending.status, message: smsJobMessage(pending.status) }, { status: 202 })
  }

  const token = crypto.randomUUID()
  const claim = await prisma.booking.updateMany({
    where: { id, businessId, confirmationRequestToken: booking.confirmationRequestToken, customerConfirmed: booking.customerConfirmed, status: { in: ['PENDING', 'CONFIRMED'] } },
    data: { confirmationRequestSent: true, customerConfirmed: null, confirmationRequestToken: token },
  })
  if (claim.count !== 1) return NextResponse.json({ error: 'Programarea tocmai a fost actualizată. Reîncarcă înainte de a trimite din nou.' }, { status: 409 })
  const prepared = { ...booking, confirmationRequestToken: token }
  let result: { success: boolean; channel?: string; error?: string; jobId?: string; status?: string; message?: string }
  try { result = social ? await sendMessengerReconfirmation(prepared, input.channel as 'FACEBOOK' | 'INSTAGRAM') : await sendConfirmationRequest(prepared) }
  catch { result = { success: false, error: 'Conexiunea nu este disponibilă. Încearcă din nou.' } }
  if (!result.success) {
    await prisma.booking.updateMany({ where: { id, confirmationRequestToken: token, customerConfirmed: null }, data: { confirmationRequestToken: booking.confirmationRequestToken, confirmationRequestSent: booking.confirmationRequestSent, customerConfirmed: booking.customerConfirmed } })
    return NextResponse.json({ error: result.error ?? 'Nu am putut trimite mesajul.' }, { status: 400 })
  }

  return NextResponse.json(result, { status: result.channel === 'SMS' && result.status !== 'SENT' ? 202 : 200 })
}
