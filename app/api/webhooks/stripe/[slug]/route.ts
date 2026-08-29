import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, stripeSecretKey: true, stripeWebhookSecret: true },
  })
  if (!business?.stripeSecretKey || !business.stripeWebhookSecret) return new NextResponse(null, { status: 404 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  const stripe = new Stripe(decrypt(business.stripeSecretKey))
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, decrypt(business.stripeWebhookSecret))
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') return NextResponse.json({ received: true })

  const session = event.data.object as Stripe.Checkout.Session
  const bookingId = session.metadata?.bookingId
  if (!bookingId || session.payment_status !== 'paid') return NextResponse.json({ received: true })

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: business.id },
    include: { service: { select: { depositAmount: true, price: true } } },
  })
  if (!booking) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

  const expectedAmount = Math.round(Number(booking.service.depositAmount ?? booking.service.price ?? 0) * 100)
  if (session.currency?.toLowerCase() !== 'ron' || session.amount_total !== expectedAmount) {
    console.error(`[Stripe:${slug}] Sumă sau monedă invalidă pentru rezervarea ${bookingId}.`)
    return NextResponse.json({ error: 'payment amount mismatch' }, { status: 400 })
  }

  await prisma.booking.updateMany({
    where: { id: booking.id, businessId: business.id, depositPaid: false },
    data: { depositPaid: true, ...(booking.status === 'PENDING' ? { status: 'CONFIRMED' as const } : {}) },
  })

  return NextResponse.json({ received: true })
}
