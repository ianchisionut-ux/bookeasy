import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resetIpayPaymentFields } from '@/lib/billing-ipay'
import {getPlanPrices} from '@/lib/plan-pricing'
import {promotionVersion} from '@/lib/promotion-campaigns'
import { launchMonth } from '@/lib/launch-policy'
import { lockLaunchBusiness, syncLaunchInTransaction } from '@/lib/launch-campaign'
import { promotionIsOpen } from '@/lib/promotion-campaigns'

const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('PAID') }),
  z.object({ mode: z.literal('STANDARD') }),
  z.object({ mode: z.literal('PRO') }),
  z.object({ mode: z.literal('FREE') }),
  z.object({ mode: z.literal('CAMPAIGN'), campaignId: z.string().min(1) }),
])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as { isSuperAdmin?: boolean } | null)?.isSuperAdmin) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Alege tipul contului și, pentru campanie, codul promoțional.' }, { status: 400 })
  const { id: businessId } = await params
  const now = new Date()
  const result = await prisma.$transaction(async tx => {
    await lockLaunchBusiness(tx, businessId)
    const business = await tx.business.findUnique({ where: { id: businessId } })
    if (!business) return { status: 404, error: 'Afacerea nu există.' }
    const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId } })
    const mode = parsed.data.mode === 'PAID' ? 'STANDARD' : parsed.data.mode
    const currentMode = enrollment && !enrollment.cancelledAt ? 'CAMPAIGN' : business.billingStatus === 'GRATUIT' ? 'FREE' : business.planName?.toUpperCase() === 'PRO' ? 'PRO' : 'STANDARD'
    if (mode === currentMode && (parsed.data.mode !== 'CAMPAIGN' || enrollment?.campaignId === parsed.data.campaignId)) return { status: 200, success: true }
    if(enrollment?.freeUntilNotice&&!enrollment.cancelledAt&&mode!=='CAMPAIGN'&&mode!=='FREE')return {status:409,error:'Campania gratuită nu poate fi trecută direct la plată. Este necesară notificarea și acceptarea expresă a noii oferte de către afacere.'}
    const prices=await getPlanPrices(tx)
    if (mode === 'PRO' && prices.proMinor === null) return { status: 409, error: 'Configurează tariful PRO în Planuri și prețuri înainte de schimbarea planului.' }
    const recordChange = () => tx.billingModeChange.create({ data: {
      businessId, fromMode: currentMode, toMode: mode,
      fromCampaignId: currentMode === 'CAMPAIGN' ? enrollment?.campaignId : null,
      toCampaignId: parsed.data.mode === 'CAMPAIGN' ? parsed.data.campaignId : null,
      previousPlanName: business.planName, previousBillingStatus: business.billingStatus,
      previousAmount: business.billingAmount, previousDueAt: business.billingDueAt,
      previousInvoiceUrl: business.billingInvoiceUrl, previousInvoiceName: business.billingInvoiceName,
      previousInvoiceExternalId: business.billingInvoiceExternalId,
    } })

    if (parsed.data.mode === 'CAMPAIGN') {
      const campaign = await tx.launchCampaign.findUnique({ where: { id: parsed.data.campaignId } })
      if (!campaign || !campaign.code || !promotionIsOpen({ ...campaign, code: campaign.code })) return { status: 409, error: 'Campania nu acceptă înscrieri noi. Activeaz-o din Coduri promoționale.' }
      if(enrollment?.freeUntilNotice&&!enrollment.cancelledAt&&!campaign.freeUntilNotice)return {status:409,error:'O campanie gratuită fără termen nu poate fi înlocuită cu o ofertă care generează plăți fără acordul afacerii.'}
      if (enrollment) {
        const hasPeriods = await tx.launchBillingPeriod.count({ where: { enrollmentId: enrollment.id } }) > 0
        if (hasPeriods && enrollment.campaignId !== campaign.id) return { status: 409, error: 'Această afacere are istoric într-o altă campanie. Poți relua campania inițială; istoricul nu poate fi înlocuit.' }
        await recordChange()
        if (hasPeriods) {
          await tx.launchEnrollment.update({ where: { id: enrollment.id }, data: { cancelledAt: null, nextSyncAt: enrollment.activatedAt ? now : null } })
        } else {
          await tx.launchEnrollment.update({ where: { id: enrollment.id }, data: {
            campaignId: campaign.id, acceptedAt: now, activatedAt: business.onboardingDone ? now : null,
            freeEndsAt: business.onboardingDone && !campaign.freeUntilNotice ? launchMonth(now, campaign.freeMonths) : null,
            promoEndsAt: business.onboardingDone && !campaign.freeUntilNotice ? launchMonth(now, campaign.freeMonths) : null,
            cancelledAt: null, billingCycle: null, nextSyncAt: business.onboardingDone ? now : null,
            freeMonths: campaign.freeMonths, promoMonths: 0, promoMinor: 0, regularMinor: campaign.freeUntilNotice?0:campaign.regularMinor, freeUntilNotice:campaign.freeUntilNotice,termsVersion:promotionVersion(campaign),
          } })
        }
      } else {
        await recordChange()
        await tx.launchEnrollment.create({ data: {
          businessId, campaignId: campaign.id, acceptedAt: now,
          activatedAt: business.onboardingDone ? now : null,
          freeEndsAt: business.onboardingDone && !campaign.freeUntilNotice ? launchMonth(now, campaign.freeMonths) : null,
          promoEndsAt: business.onboardingDone && !campaign.freeUntilNotice ? launchMonth(now, campaign.freeMonths) : null,
          nextSyncAt: business.onboardingDone ? now : null,
          freeMonths: campaign.freeMonths, promoMonths: 0, promoMinor: 0, regularMinor: campaign.freeUntilNotice?0:campaign.regularMinor, freeUntilNotice:campaign.freeUntilNotice,termsVersion:promotionVersion(campaign),
        } })
      }
      await tx.business.update({ where: { id: businessId }, data: {
        planName: 'Campanie · Gratuit', billingStatus: 'GRATUIT', billingAmount: 0, billingSubtotal: 0,
        billingDueAt: null, billingDueNotifiedAt: null, billingPaidAt: null,
        billingInvoiceUrl: null, billingInvoiceName: null, billingInvoiceUploadedAt: null, billingInvoiceExternalId: null,
        billingStripeCheckoutSessionId: null, billingStripePaymentIntentId: null, ...resetIpayPaymentFields(),
        ...(business.billingSuspendedAt ? { accountActive: true, billingSuspendedAt: null } : {}),
      } })
      if (business.onboardingDone) await syncLaunchInTransaction(tx, businessId, now)
      return { status: 200, success: true }
    }

    await recordChange()
    if (enrollment && !enrollment.cancelledAt) {
      await syncLaunchInTransaction(tx, businessId, now)
      await tx.launchEnrollment.update({ where: { id: enrollment.id }, data: { cancelledAt: now, nextSyncAt: null } })
    }
    const paid = mode !== 'FREE'
    const amount = mode === 'STANDARD' ? prices.standardMinor / 100 : mode === 'PRO' ? prices.proMinor===null?null:prices.proMinor/100 : 0
    await tx.business.update({ where: { id: businessId }, data: {
      planName: mode === 'PRO' ? 'Pro' : paid ? 'Standard' : 'Gratuit', billingStatus: paid ? 'NEPLATIT' : 'GRATUIT',
      billingAmount: amount, billingSubtotal: amount === null ? null : paid ? Number((amount / (1 + Number(business.billingVatRate) / 100)).toFixed(6)) : 0,
      billingCurrency: 'RON', billingDueAt: paid && amount!==null && amount>0 && business.onboardingDone ? now : null,
      billingDueNotifiedAt: null, billingPaidAt: null,
      billingInvoiceUrl: null, billingInvoiceName: null, billingInvoiceUploadedAt: null, billingInvoiceExternalId: null,
      billingStripeCheckoutSessionId: null, billingStripePaymentIntentId: null, ...resetIpayPaymentFields(),
      ...(business.billingSuspendedAt ? { accountActive: true, billingSuspendedAt: null } : {}),
    } })
    return { status: 200, success: true }
  }, { timeout: 20000 })
  return NextResponse.json(result, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
