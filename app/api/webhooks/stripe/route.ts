import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { amountToMinorUnits, getInvoiceReference } from '@/lib/billing-invoice'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY lipsește')
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret)
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.kind === 'bookeasy_invoice') {
        if (session.payment_status === 'paid') await markInvoicePaid(session)
      } else if (session.mode === 'subscription' && typeof session.subscription === 'string') {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription)
        await upsertSubscription(subscription)
      }
      break
    }
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.kind === 'bookeasy_invoice') await markInvoicePaid(session)
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await upsertSubscription(event.data.object as Stripe.Subscription)
      break
    }
    case 'invoice.payment_failed': {
      // TODO: notifică owner-ul, eventual suspendă botul dacă rămâne UNPAID mai multe zile
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function markInvoicePaid(session: Stripe.Checkout.Session) {
  const businessId = session.metadata?.businessId
  const invoiceRef = session.metadata?.invoiceRef
  if (!businessId || !invoiceRef) throw new Error('Metadate factură Stripe incomplete')

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) throw new Error('Business Stripe inexistent')
  const expectedRef = getInvoiceReference(business)
  const expectedAmount = business.billingAmount === null ? null : amountToMinorUnits(Number(business.billingAmount))
  if (
    expectedRef !== invoiceRef ||
    business.billingStripeCheckoutSessionId !== session.id ||
    expectedAmount === null ||
    session.amount_total !== expectedAmount ||
    session.currency?.toUpperCase() !== (business.billingCurrency || 'RON').toUpperCase()
  ) throw new Error('Plata Stripe nu corespunde facturii curente')

  await prisma.business.update({
    where: { id: business.id },
    data: {
      billingStatus: 'PLATIT',
      billingPaidAt: new Date(),
      billingStripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      billingDueNotifiedAt: null,
      ...(business.billingSuspendedAt ? { accountActive: true, billingSuspendedAt: null } : {}),
    },
  })
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const businessId = sub.metadata.businessId
  const planId = sub.metadata.planId
  if (!businessId || !planId) return

  await prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      planId,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      status: mapStripeStatus(sub.status),
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
    update: {
      status: mapStripeStatus(sub.status),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  })
}

function mapStripeStatus(stripeStatus: string) {
  const map: Record<string, 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID'> = {
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
  }
  return map[stripeStatus] ?? 'CANCELED'
}
