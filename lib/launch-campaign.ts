import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { LAUNCH_OFFER, launchCycle, launchMonth, launchPrice, launchView } from './launch-policy'
import {findPromotion,promotionIsOpen,promotionVersion} from './promotion-campaigns'
import {getPlanPrices} from './plan-pricing'
import {FREE_CAMPAIGN_TERMS_VERSION} from './free-campaign-terms'
import { resetIpayPaymentFields } from './billing-ipay'

type Tx = Prisma.TransactionClient

export class LaunchSignupError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function standardSignupData(regularMinor: number) {
  return { planName: 'Standard', billingStatus: regularMinor===0?'GRATUIT' as const:'NEPLATIT' as const, billingAmount: regularMinor / 100, billingSubtotal: Number((regularMinor / 100 / 1.21).toFixed(6)), billingCurrency: 'RON' }
}

export async function launchSignupData(promoCode?: string, db: Pick<Tx, '$queryRaw'> = prisma, offerVersion?:string, planPriceVersion?:string) {
  if (!promoCode?.trim()) {
    const prices=await getPlanPrices(db)
    if(planPriceVersion!==undefined&&planPriceVersion!==prices.version)throw new LaunchSignupError('Tarifele s-au actualizat. Reîncarcă pagina și verifică oferta.',409)
    return { ...standardSignupData(prices.standardMinor), launchEnrollment: undefined }
  }
  const campaign = await findPromotion(promoCode,db)
  if (!campaign) throw new LaunchSignupError('Codul promoțional nu este valid. Verifică-l sau continuă fără cod.')
  if (!promotionIsOpen(campaign)) throw new LaunchSignupError('Codul promoțional nu este disponibil în acest moment. Poți continua fără cod, cu planul Standard.',409)
  if(offerVersion!==undefined&&offerVersion!==promotionVersion(campaign))throw new LaunchSignupError('Verifică din nou codul și acceptă condițiile actuale ale ofertei.',409)
  return {
    planName: 'Lansare · Gratuit', billingStatus: 'GRATUIT' as const, billingAmount: 0, billingSubtotal: 0,
    launchEnrollment: { create: { campaignId: campaign.id, ...LAUNCH_OFFER,freeMonths:campaign.freeMonths,freeUntilNotice:campaign.freeUntilNotice,regularMinor:campaign.freeUntilNotice?0:campaign.regularMinor,termsVersion:campaign.freeUntilNotice?FREE_CAMPAIGN_TERMS_VERSION:promotionVersion(campaign) } },
  }
}

export async function activateStandardSubscription(tx: Tx, businessId: string, now: Date) {
  const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId }, select: { cancelledAt: true } })
  if (enrollment && !enrollment.cancelledAt) return
  // Start normal billing only once, when onboarding finishes; preserve manual billing settings.
  await tx.business.updateMany({ where: { id: businessId, planName: {in:['Standard','Pro']}, billingStatus: 'NEPLATIT', billingDueAt: null, billingAmount:{gt:0} }, data: { billingDueAt: now } })
}

export async function lockLaunchBusiness(tx: Tx, businessId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${businessId}, 20261015))`
}

export async function activateLaunch(tx: Tx, businessId: string, now: Date) {
  const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId }, select: { freeMonths: true, promoMonths: true, activatedAt: true, cancelledAt: true, freeUntilNotice: true } })
  if (!enrollment || enrollment.activatedAt || enrollment.cancelledAt) return
  await tx.launchEnrollment.updateMany({ where: { businessId, activatedAt: null, cancelledAt: null }, data: {
    activatedAt: now,
    freeEndsAt: enrollment.freeUntilNotice ? null : launchMonth(now, enrollment.freeMonths),
    promoEndsAt: enrollment.freeUntilNotice ? null : launchMonth(now, enrollment.freeMonths + enrollment.promoMonths),
    nextSyncAt: enrollment.freeUntilNotice ? null : launchMonth(now, 1),
  } })
}

export async function syncLaunchInTransaction(tx: Tx, businessId: string, now: Date) {
  const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId }, include: { business: true } })
  if (!enrollment || enrollment.cancelledAt || !enrollment.activatedAt) return false
  // Open-ended free offers never create billable periods or roll into Standard.
  if (enrollment.freeUntilNotice) {
    await tx.business.update({where:{id:businessId},data:{planName:'Campanie · Gratuit',billingStatus:'GRATUIT',billingAmount:0,billingSubtotal:0,billingDueAt:null}})
    await tx.launchEnrollment.update({where:{id:enrollment.id},data:{nextSyncAt:null,freeEndsAt:null,promoEndsAt:null}})
    return true
  }
  const business = enrollment.business
  const currentCycle = launchCycle(enrollment.activatedAt, now)
  // One unique period per anniversary, including recovery after scheduler downtime.
  await tx.launchBillingPeriod.createMany({ data: Array.from({ length: currentCycle + 1 }, (_, cycle) => ({
    enrollmentId: enrollment.id, cycle, startsAt: launchMonth(enrollment.activatedAt!, cycle), endsAt: launchMonth(enrollment.activatedAt!, cycle + 1), amountMinor: launchPrice(enrollment, cycle),
    paidAt: launchPrice(enrollment, cycle) === 0 ? enrollment.activatedAt : null,
  })), skipDuplicates: true })

  const previous = enrollment.billingCycle === null ? null : await tx.launchBillingPeriod.findUnique({ where: { enrollmentId_cycle: { enrollmentId: enrollment.id, cycle: enrollment.billingCycle } } })
  if (previous) {
    await tx.launchBillingPeriod.update({ where: { id: previous.id }, data: {
      ...(business.billingInvoiceUrl ? { invoiceUrl: business.billingInvoiceUrl, invoiceName: business.billingInvoiceName, invoiceExternalId: business.billingInvoiceExternalId } : {}),
      // Also reconcile payments recorded by existing bank callbacks/manual tools.
      ...(business.billingStatus === 'PLATIT' && business.billingPaidAt && Math.round(Number(business.billingAmount) * 100) === previous.amountMinor ? { paidAt: business.billingPaidAt } : {}),
    } })
  }
  const unpaid = await tx.launchBillingPeriod.findFirst({ where: { enrollmentId: enrollment.id, amountMinor: { gt: 0 }, paidAt: null, startsAt: { lte: now } }, orderBy: { cycle: 'asc' } })
  const selected = unpaid ?? await tx.launchBillingPeriod.findUniqueOrThrow({ where: { enrollmentId_cycle: { enrollmentId: enrollment.id, cycle: currentCycle } } })
  const changedCycle = enrollment.billingCycle !== selected.cycle
  const gross = selected.amountMinor / 100
  const status = gross === 0 ? 'GRATUIT' : selected.paidAt ? 'PLATIT' : !changedCycle && business.billingStatus === 'RESTANT' ? 'RESTANT' : 'NEPLATIT'
  await tx.business.update({ where: { id: businessId }, data: {
    planName: selected.cycle < enrollment.freeMonths ? 'Lansare · Gratuit' : selected.cycle < enrollment.freeMonths + enrollment.promoMonths ? `Lansare · Promo ${selected.amountMinor / 100}` : 'Standard',
    billingStatus: status, billingAmount: gross, billingSubtotal: Number((gross / (1 + Number(business.billingVatRate) / 100)).toFixed(6)), billingCurrency: 'RON',
    billingDueAt: gross === 0 ? null : selected.startsAt,
    ...(changedCycle ? { billingInvoiceUrl: selected.invoiceUrl, billingInvoiceName: selected.invoiceName, billingInvoiceExternalId: selected.invoiceExternalId, billingInvoiceUploadedAt: null, billingPaidAt: selected.paidAt, billingDueNotifiedAt: null, billingStripeCheckoutSessionId: null, billingStripePaymentIntentId: null, ...resetIpayPaymentFields() } : {}),
  } })
  await tx.launchEnrollment.update({ where: { id: enrollment.id }, data: { billingCycle: selected.cycle, nextSyncAt: launchMonth(enrollment.activatedAt, currentCycle + 1) } })
  return true
}

export async function syncLaunchBusiness(businessId: string, now = new Date()) {
  return prisma.$transaction(async tx => { await lockLaunchBusiness(tx, businessId); return syncLaunchInTransaction(tx, businessId, now) }, { timeout: 20000 })
}

export async function refreshLaunchIfDue(businessId: string, now = new Date()) {
  const enrollment = await prisma.launchEnrollment.findUnique({ where: { businessId }, select: { nextSyncAt: true, cancelledAt: true } })
  if (enrollment && !enrollment.cancelledAt && enrollment.nextSyncAt && enrollment.nextSyncAt <= now) await syncLaunchBusiness(businessId, now)
}

export async function syncLaunchBatch(now = new Date(), batchSize = 100) {
  const due = await prisma.launchEnrollment.findMany({ where: { cancelledAt: null, nextSyncAt: { lte: now }, activatedAt: { not: null } }, orderBy: [{ nextSyncAt: 'asc' }, { id: 'asc' }], select: { businessId: true }, take: batchSize })
  let updated = 0, failed = 0
  for (let index = 0; index < due.length; index += 8) {
    const results = await Promise.allSettled(due.slice(index, index + 8).map(row => syncLaunchBusiness(row.businessId, now)))
    for (const result of results) { if (result.status === 'fulfilled') updated += Number(result.value); else { failed++; console.error('[launch] Period update failed') } }
  }
  return { updated, failed, batchFull: due.length === batchSize }
}

export async function getLaunchDetails(businessId: string, now = new Date()) {
  const enrollment = await prisma.launchEnrollment.findUnique({ where: { businessId }, include: { business: { select: { billingAmount: true, billingDueAt: true } }, periods: { orderBy: { cycle: 'desc' }, take: 36 } } })
  if (!enrollment) return null
  return { id: enrollment.id, managed: !enrollment.cancelledAt, ...launchView(enrollment, now), freeMonths: enrollment.freeMonths, promoMonths: enrollment.promoMonths, promoMinor: enrollment.promoMinor, regularMinor: enrollment.regularMinor, billingAmount: enrollment.business.billingAmount === null ? null : Number(enrollment.business.billingAmount), dueAt: enrollment.business.billingDueAt?.toISOString() ?? null, acceptedAt: enrollment.acceptedAt.toISOString(), activatedAt: enrollment.activatedAt?.toISOString() ?? null,
    periods: enrollment.periods.map(p => ({ id: p.id, cycle: p.cycle, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString(), amount: p.amountMinor / 100, paidAt: p.paidAt?.toISOString() ?? null, hasInvoice: Boolean(p.invoiceUrl) })) }
}
