import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ACTIVE_IPAY_STATES,
  createIpayInvoiceCheckout,
  IPAY_ATTEMPT_TTL_MS,
  isActiveIpayAttempt,
  newIpayOrderNumber,
  validateIpayInvoice,
} from '@/lib/billing-ipay'
import { IPAY_RON_CURRENCY } from '@/lib/payments/ipay'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!session || !businessId || (session as any).isSuperAdmin)
    return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any).role !== 'OWNER')
    return NextResponse.json({ error: 'Doar proprietarul business-ului poate iniția plata facturii.' }, { status: 403 })

  const { allowed } = rateLimit(`ipay-invoice:${businessId}:${getClientIp(req)}`, 10, 60 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Prea multe încercări de plată. Încearcă mai târziu.' }, { status: 429 })

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { users: { where: { role: 'OWNER' }, select: { email: true }, take: 1 } },
  })
  if (!business) return NextResponse.json({ error: 'Afacerea nu există.' }, { status: 404 })
  if (isActiveIpayAttempt(business.billingIpayPaymentState, business.billingIpayStartedAt)) {
    return NextResponse.json({ error: 'Există deja o plată inițiată pentru această factură. Finalizeaz-o sau încearcă din nou peste 30 de minute.' }, { status: 409 })
  }

  let payer: ReturnType<typeof validateIpayInvoice>
  try {
    payer = validateIpayInvoice(business, business.users[0]?.email)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Factura nu poate fi plătită.' }, { status: 400 })
  }

  const startedAt = new Date()
  const staleBefore = new Date(startedAt.getTime() - IPAY_ATTEMPT_TTL_MS)
  const orderNumber = newIpayOrderNumber(business.id)
  const claim = await prisma.business.updateMany({
    where: {
      id: business.id,
      billingStatus: { in: ['NEPLATIT', 'RESTANT'] },
      billingInvoiceUrl: business.billingInvoiceUrl,
      billingInvoiceUploadedAt: business.billingInvoiceUploadedAt,
      OR: [
        { billingIpayPaymentState: null },
        { billingIpayPaymentState: { notIn: [...ACTIVE_IPAY_STATES] } },
        { billingIpayStartedAt: null },
        { billingIpayStartedAt: { lt: staleBefore } },
      ],
    },
    data: {
      billingIpayOrderId: null,
      billingIpayOrderNumber: orderNumber,
      billingIpayPaymentState: 'REGISTERING',
      billingIpayPaymentError: null,
      billingIpayStartedAt: startedAt,
      billingIpayAmountMinor: payer.amountMinor,
      billingIpayCurrency: IPAY_RON_CURRENCY,
      billingIpayInvoiceReference: payer.invoiceReference,
    },
  })
  if (claim.count !== 1) {
    return NextResponse.json({ error: 'Factura sau starea plății s-a modificat. Reîncarcă pagina și încearcă din nou.' }, { status: 409 })
  }

  try {
    const checkout = await createIpayInvoiceCheckout(business, orderNumber, payer)
    const saved = await prisma.business.updateMany({
      where: {
        id: business.id,
        billingIpayOrderNumber: orderNumber,
        billingIpayPaymentState: 'REGISTERING',
        billingIpayInvoiceReference: payer.invoiceReference,
      },
      data: { billingIpayOrderId: checkout.orderId, billingIpayPaymentState: 'REGISTERED' },
    })
    if (saved.count !== 1) throw new Error('Tranzacția BT iPay nu a putut fi asociată facturii curente.')
    return NextResponse.json({ checkoutUrl: checkout.paymentUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plata nu a putut fi inițiată.'
    await prisma.business.updateMany({
      where: { id: business.id, billingIpayOrderNumber: orderNumber, billingIpayPaymentState: 'REGISTERING' },
      data: { billingIpayPaymentState: 'FAILED', billingIpayPaymentError: message.slice(0, 500) },
    }).catch(() => {})
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
