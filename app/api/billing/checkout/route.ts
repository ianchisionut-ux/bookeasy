import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import {
  createIpayInvoiceCheckout,
  isPlatformIpayConfigured,
  newIpayOrderNumber,
  validateIpayInvoice,
} from '@/lib/billing-ipay'
import { IPAY_RON_CURRENCY } from '@/lib/payments/ipay'
import { lockLaunchBusiness, refreshLaunchIfDue } from '@/lib/launch-campaign'

const noStore = { 'Cache-Control': 'private, no-store' }
const blockedStates = new Set(['REGISTERING', 'REGISTERED', 'VERIFYING', 'REVIEW_REQUIRED', 'DEPOSITED'])

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!session || !businessId || (session as any).role !== 'OWNER' || (session as any).isSuperAdmin) {
    return failure('Doar proprietarul afacerii poate plăti factura.', 403)
  }
  if (req.headers.get('origin') !== req.nextUrl.origin) return failure('Origine invalidă.', 403)
  if (!isPlatformIpayConfigured()) return failure('Plata online prin BT iPay nu este disponibilă momentan.', 503)

  const { allowed } = await rateLimit(`billing-ipay-checkout:${businessId}`, 8, 60 * 60 * 1000)
  if (!allowed) return failure('Prea multe încercări de plată. Încearcă mai târziu.', 429)

  await refreshLaunchIfDue(businessId)
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return failure('Afacerea nu a fost găsită.', 404)
  if (blockedStates.has(business.billingIpayPaymentState || '') || (business.billingIpayOrderId && business.billingIpayPaymentState !== 'DECLINED')) {
    return failure('Există deja o încercare de plată pentru această factură. Verificăm rezultatul cu banca; dacă nu se actualizează, contactează echipa BookEasy.', 409)
  }

  let payer: ReturnType<typeof validateIpayInvoice>
  try {
    payer = validateIpayInvoice(business, session.user?.email)
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Factura nu poate fi plătită online.', 409)
  }

  const enrollment = await prisma.launchEnrollment.findUnique({
    where: { businessId },
    select: { id: true, billingCycle: true, cancelledAt: true },
  })
  if (enrollment && !enrollment.cancelledAt) {
    const period = enrollment.billingCycle === null ? null : await prisma.launchBillingPeriod.findUnique({
      where: { enrollmentId_cycle: { enrollmentId: enrollment.id, cycle: enrollment.billingCycle } },
      select: { amountMinor: true, invoiceUrl: true, paidAt: true },
    })
    if (!period || period.amountMinor !== payer.amountMinor || period.invoiceUrl !== business.billingInvoiceUrl || period.paidAt) {
      return failure('Perioada campaniei sau factura s-a modificat. Reîncarcă pagina înainte de plată.', 409)
    }
  }

  const orderNumber = newIpayOrderNumber(businessId)
  const reserved = await prisma.$transaction(async tx => {
    await lockLaunchBusiness(tx, businessId)
    return tx.business.updateMany({
    where: {
      id: businessId,
      billingStatus: { in: ['NEPLATIT', 'RESTANT'] },
      billingInvoiceUrl: business.billingInvoiceUrl,
      billingInvoiceName: business.billingInvoiceName,
      billingInvoiceExternalId: business.billingInvoiceExternalId,
      billingInvoiceUploadedAt: business.billingInvoiceUploadedAt,
      billingAmount: business.billingAmount,
      billingCurrency: business.billingCurrency,
      billingIpayPaymentState: business.billingIpayPaymentState,
      billingIpayOrderId: business.billingIpayOrderId,
    },
    data: {
      billingIpayOrderId: null,
      billingIpayOrderNumber: orderNumber,
      billingIpayPaymentState: 'REGISTERING',
      billingIpayPaymentError: null,
      billingIpayStartedAt: new Date(),
      billingIpayAmountMinor: payer.amountMinor,
      billingIpayCurrency: IPAY_RON_CURRENCY,
      billingIpayInvoiceReference: payer.invoiceReference,
    },
    })
  }, { timeout: 20000 })
  if (reserved.count !== 1) return failure('Factura s-a modificat. Reîncarcă pagina înainte de plată.', 409)

  try {
    const order = await createIpayInvoiceCheckout(business, orderNumber, payer)
    const saved = await prisma.business.updateMany({
      where: {
        id: businessId,
        billingIpayOrderNumber: orderNumber,
        billingIpayPaymentState: 'REGISTERING',
        billingInvoiceUrl: business.billingInvoiceUrl,
        billingInvoiceExternalId: business.billingInvoiceExternalId,
        billingAmount: business.billingAmount,
      },
      data: { billingIpayOrderId: order.orderId, billingIpayPaymentState: 'REGISTERED' },
    })
    if (saved.count !== 1) {
      console.error(`[billing-ipay:${businessId}] Factura s-a modificat după înregistrarea comenzii ${order.orderId}.`)
      return failure('Factura s-a modificat în timpul inițierii. Contactează echipa BookEasy înainte de o nouă încercare.', 409)
    }
    return NextResponse.json({ paymentUrl: order.paymentUrl }, { headers: noStore })
  } catch (error) {
    // A timeout may have registered an order at the bank without returning its
    // ID. Do not permit another charge until support has reconciled the attempt.
    const reason = error instanceof Error ? error.message : 'Înregistrarea nu a putut fi confirmată.'
    await prisma.business.updateMany({
      where: { id: businessId, billingIpayOrderNumber: orderNumber, billingIpayPaymentState: 'REGISTERING' },
      data: { billingIpayPaymentState: 'REVIEW_REQUIRED', billingIpayPaymentError: reason.slice(0, 500) },
    })
    console.error(`[billing-ipay:${businessId}] Înregistrarea plății necesită verificare: ${reason}`)
    return failure('Nu am primit confirmarea inițierii de la bancă. Contactează echipa BookEasy înainte de a încerca din nou.', 502)
  }
}
