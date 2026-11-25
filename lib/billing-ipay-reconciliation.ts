import { prisma } from '@/lib/prisma'
import { amountToMinorUnits, getInvoiceReference } from '@/lib/billing-invoice'
import {
  getIpayInvoiceStatus,
  isIpayInvoiceConfirmed,
  isIpayInvoiceTerminalFailure,
  canReconcilePlatformIpay,
} from '@/lib/billing-ipay'
import { lockLaunchBusiness } from '@/lib/launch-campaign'

export type IpayReconciliationResult = 'confirmed' | 'declined' | 'pending' | 'stale'

export async function reconcileIpayBusiness(business: Awaited<ReturnType<typeof loadIpayBusiness>>) {
  if (!business || !business.billingIpayOrderId || business.billingIpayAmountMinor === null) return 'stale' as const
  if (business.billingStatus === 'PLATIT' && business.billingIpayPaymentState === 'DEPOSITED') return 'confirmed' as const
  if (
    getInvoiceReference(business) !== business.billingIpayInvoiceReference ||
    amountToMinorUnits(Number(business.billingAmount)) !== business.billingIpayAmountMinor ||
    business.billingCurrency.toUpperCase() !== 'RON'
  ) return 'stale' as const

  const status = await getIpayInvoiceStatus(business)
  if (isIpayInvoiceConfirmed(status, business)) {
    const paidAt = new Date()
    const updated = await prisma.$transaction(async tx => {
      await lockLaunchBusiness(tx, business.id)
      const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId: business.id } })
      const managed = Boolean(enrollment && !enrollment.cancelledAt)
      if (managed && enrollment!.billingCycle === null) return false
      const period = managed ? await tx.launchBillingPeriod.findUnique({
        where: { enrollmentId_cycle: { enrollmentId: enrollment!.id, cycle: enrollment!.billingCycle! } },
      }) : null
      if (managed && (!period || period.invoiceUrl !== business.billingInvoiceUrl || period.amountMinor !== business.billingIpayAmountMinor)) return false

      const changed = await tx.business.updateMany({
        where: {
          id: business.id,
          billingIpayOrderId: business.billingIpayOrderId,
          billingIpayOrderNumber: business.billingIpayOrderNumber,
          billingIpayAmountMinor: business.billingIpayAmountMinor,
          billingIpayCurrency: business.billingIpayCurrency,
          billingIpayInvoiceReference: business.billingIpayInvoiceReference,
          billingInvoiceUrl: business.billingInvoiceUrl,
          billingAmount: business.billingAmount,
          billingStatus: { in: ['NEPLATIT', 'RESTANT'] },
        },
        data: {
          billingStatus: 'PLATIT',
          billingPaidAt: paidAt,
          billingIpayPaymentState: 'DEPOSITED',
          billingIpayPaymentError: null,
          billingDueNotifiedAt: null,
        },
      })
      if (changed.count !== 1) return false

      // A campaign period is the billing source of truth. Record the deposit
      // there too, otherwise the next campaign sync could reopen the invoice.
      if (period && !period.paidAt) {
        const updatedPeriod = await tx.launchBillingPeriod.updateMany({
          where: {
            id: period.id,
            invoiceUrl: business.billingInvoiceUrl,
            amountMinor: business.billingIpayAmountMinor,
            paidAt: null,
          },
          data: { paidAt },
        })
        // Rolling back is essential if the period changed after it was read.
        if (updatedPeriod.count !== 1) throw new Error('Perioada campaniei s-a modificat în timpul reconcilierii.')
      }
      if (business.billingSuspendedAt) {
        const overdue = enrollment && !enrollment.cancelledAt
          ? await tx.launchBillingPeriod.count({ where: { enrollmentId: enrollment.id, amountMinor: { gt: 0 }, paidAt: null, startsAt: { lte: new Date(paidAt.getTime() - 15 * 86400000) } } })
          : 0
        if (!overdue) await tx.business.updateMany({ where: { id: business.id, billingIpayOrderId: business.billingIpayOrderId }, data: { accountActive: true, billingSuspendedAt: null } })
      }
      return true
    }, { timeout: 20000 })
    if (updated) return 'confirmed' as const
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
  if (!canReconcilePlatformIpay()) return { checked: 0, confirmed: 0, declined: 0 }
  const businesses = await prisma.business.findMany({
    where: {
      billingIpayPaymentState: { in: ['REGISTERED', 'VERIFYING'] },
      billingIpayOrderId: { not: null },
    },
    orderBy: { billingIpayStartedAt: 'asc' },
    take: 30,
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
