import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { amountToMinorUnits, getInvoiceReference } from '@/lib/billing-invoice'

export async function POST() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!session || !businessId || (session as any).isSuperAdmin)
    return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })

  const secretKey = process.env.STRIPE_SECRET_KEY
  const appUrl = process.env.APP_URL?.replace(/\/$/, '')
  if (!secretKey || !appUrl)
    return NextResponse.json({ error: 'Plata cu cardul nu este configurată încă.' }, { status: 503 })

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { users: { where: { role: 'OWNER' }, select: { email: true }, take: 1 } },
  })
  if (!business) return NextResponse.json({ error: 'Afacerea nu există.' }, { status: 404 })
  if (!['NEPLATIT', 'RESTANT'].includes(business.billingStatus))
    return NextResponse.json({ error: 'Factura nu mai este disponibilă pentru plată.' }, { status: 409 })
  if (!business.billingInvoiceUrl)
    return NextResponse.json({ error: 'Nu există o factură emisă pentru plată.' }, { status: 400 })

  const invoiceRef = getInvoiceReference(business)
  const amount = business.billingAmount === null ? null : amountToMinorUnits(Number(business.billingAmount))
  const currency = (business.billingCurrency || 'RON').toLowerCase()
  if (!invoiceRef || !amount)
    return NextResponse.json({ error: 'Factura nu are o sumă validă.' }, { status: 400 })
  if (!/^[a-z]{3}$/.test(currency))
    return NextResponse.json({ error: 'Moneda facturii nu este validă.' }, { status: 400 })

  const stripe = new Stripe(secretKey)
  let previousCheckoutId: string | null = null
  if (business.billingStripeCheckoutSessionId) {
    previousCheckoutId = business.billingStripeCheckoutSessionId
    try {
      const existing = await stripe.checkout.sessions.retrieve(business.billingStripeCheckoutSessionId)
      if (existing.status === 'open' && existing.url && existing.metadata?.invoiceRef === invoiceRef)
        return NextResponse.json({ checkoutUrl: existing.url })
    } catch {
      // Sesiunea poate fi expirată sau creată cu alte credențiale; generăm una nouă.
    }
  }

  let stripeCustomerId = business.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: business.billingEmail || business.users[0]?.email,
      name: business.billingLegalName || business.name,
      metadata: { businessId: business.id },
    })
    stripeCustomerId = customer.id
    await prisma.business.update({ where: { id: business.id }, data: { stripeCustomerId } })
  }

  const metadata = { kind: 'bookeasy_invoice', businessId: business.id, invoiceRef }
  const checkout = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    client_reference_id: business.id,
    mode: 'payment',
    payment_method_types: ['card'],
    locale: 'ro',
    submit_type: 'pay',
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: amount,
        product_data: {
          name: `Abonament BookEasy${business.planName ? ` — ${business.planName}` : ''}`,
          description: business.billingInvoiceName || undefined,
        },
      },
    }],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${appUrl}/dashboard/setari?payment=success`,
    cancel_url: `${appUrl}/dashboard/setari?payment=cancelled`,
  }, {
    // Împiedică două clickuri simultane să genereze două plăți pentru aceeași factură.
    idempotencyKey: `bookeasy-invoice-${business.id}-${invoiceRef}${previousCheckoutId ? `-retry-${previousCheckoutId}` : ''}`,
  })

  await prisma.business.update({
    where: { id: business.id },
    data: { billingStripeCheckoutSessionId: checkout.id },
  })
  return NextResponse.json({ checkoutUrl: checkout.url })
}
