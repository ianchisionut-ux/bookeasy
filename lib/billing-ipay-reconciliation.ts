import { prisma } from '@/lib/prisma'
import { getInvoiceReference } from '@/lib/billing-invoice'
import {
  getIpayInvoiceStatus,
  isIpayInvoiceConfirmed,
  isIpayInvoiceTerminalFailure,
  isPlatformIpayConfigured,
} from '@/lib/billing-ipay'

export type IpayReconciliationResult = 'confirmed' | 'declined' | 'pending' | 'stale'

export async function reconcileIpayBusiness(business: Awaited<ReturnType<typeof loadIpayBusiness>>) {
  if (!business || !business.billingIpayOrderId) return 'stale' as const
  if (business.billingStatus === 'PLATIT' && business.billingIpayPaymentState === 'DEPOSITED') return 'confirmed' as const
  if (getInvoiceReference(business) !== business.billingIpayInvoiceReference) return 'stale' as const

  const status = await getIpayInvoiceStatus(business)
  if (isIpayInvoiceConfirmed(status, business)) {
    const paidAt = new Date()
    const updated = await prisma.business.updateMany({
      where: {
        id: business.id,
        billingIpayOrderId: business.billingIpayOrderId,
        billingIpayOrderNumber: business.billingIpayOrderNumber,
        billingIpayAmountMinor: business.billingIpayAmountMinor,
        billingIpayCurrency: business.billingIpayCurrency,
        billingIpayInvoiceReference: business.billingIpayInvoiceReference,
        billingStatus: { in: ['NEPLATIT', 'RESTANT'] },
      },
      data: {
        billingStatus: 'PLATIT',
        billingPaidAt: paidAt,
        billingIpayPaymentState: 'DEPOSITED',
        billingIpayPaymentError: null,
        billingDueNotifiedAt: null,
        ...(business.billingSuspendedAt ? { accountActive: true, billingSuspendedAt: null } : {}),
      },
    })
    if (updated.count === 1) return 'confirmed' as const
    const current = await loadIpayBusiness(business.id)
    return current?.billingStatus === 'PLATIT' && current.billingIpayPaymentState === 'DEPOSITED'
      ? 'confirmed' as const
      : 'stale' as const
  }

  if (isIpayInvoiceTerminalFailure(status, business)) {
    await prisma.business.updateMany({
      where: { id: business.id, billingIpayOrderId: business.billingIpayOrderId },
      data: {
        billingIpayPaymentState: 'DECLINED',
        billingIpayPaymentError: String(status.actionCodeDescription || status.errorMessage || 'Plată refuzată').slice(0, 500),
      },
    })
    return 'declined' as const
  }

  await prisma.business.updateMany({
    where: { id: business.id, billingIpayOrderId: business.billingIpayOrderId },
    data: { billingIpayPaymentState: 'VERIFYING', billingIpayPaymentError: 'Confirmarea băncii este în curs.' },
  })
  return 'pending' as const
}

export function loadIpayBusiness(id: string) {
  return prisma.business.findUnique({ where: { id } })
}

export async function reconcileIpayInvoicePayments() {
  if (!isPlatformIpayConfigured()) return { checked: 0, confirmed: 0, declined: 0 }
  const businesses = await prisma.business.findMany({
    where: {
      billingIpayPaymentState: { in: ['REGISTERED', 'VERIFYING'] },
      billingIpayOrderId: { not: null },
    },
    orderBy: { billingIpayStartedAt: 'asc' },
    take: 100,
  })
  let confirmed = 0
  let declined = 0
  for (const business of businesses) {
    try {
      const result = await reconcileIpayBusiness(business)
      if (result === 'confirmed') confirmed++
      if (result === 'declined') declined++
    } catch (error) {
      console.error(`[billing-ipay:${business.id}] Reconciliere eșuată:`, error instanceof Error ? error.message : error)
    }
  }
  return { checked: businesses.length, confirmed, declined }
}
