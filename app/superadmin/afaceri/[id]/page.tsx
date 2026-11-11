import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { BackLink } from '@/components/ui/back-link'
import BusinessAdminPanel from './business-admin-panel'
import { ContractAdminSection } from './contract-admin-section'
import { buildContractDocument, documentHash } from '@/lib/business-contracts'

import { getLaunchDetails, refreshLaunchIfDue } from '@/lib/launch-campaign'
import { LaunchBusinessCard } from '@/components/launch-campaign-card'
import { listPromotions, promotionIsOpen } from '@/lib/promotion-campaigns'
import { isPlatformSmsReady } from '@/lib/sms-routing'

export default async function SuperAdminBusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await refreshLaunchIfDue(id)
  const [business, signatures, platformSmsReady] = await Promise.all([
    prisma.business.findUnique({
      where: { id },
      include: {
        channels: { select: { id: true, type: true, externalId: true, wabaId: true, status: true, enabledByOwner: true, displayName: true, authProvider: true } },
        practitioners: {
          where: { active: true },
          orderBy: { name: 'asc' },
          include: { googleCalendar: { select: { googleEmail: true, calendarName: true, calendarId: true, syncEnabled: true, includeCustomerDetails: true, lastSyncAt: true, lastError: true } } },
        },
        users: { where: { role: 'OWNER' } },
        _count: { select: { bookings: true } },
      },
    }),
    prisma.contractSignature.findMany({ where: { businessId: id }, orderBy: { customerSignedAt: 'desc' }, select: { id: true, type: true, documentHash: true, customerSignerName: true, customerSignedAt: true, providerSignedAt: true } }),
    isPlatformSmsReady(),
  ])

  if (!business) notFound()
  const [launch, enrollment, promotions] = await Promise.all([
    getLaunchDetails(id),
    prisma.launchEnrollment.findUnique({ where: { businessId: id }, select: { campaignId: true, cancelledAt: true } }),
    listPromotions(),
  ])
  const campaignManaged = Boolean(enrollment && !enrollment.cancelledAt)
  const billingMode = campaignManaged ? 'CAMPAIGN' : business.billingStatus === 'GRATUIT' ? 'FREE' : 'PAID'

  return (
    <div className="dashboard-page">
      <div className="mb-4">
        <BackLink href="/superadmin/afaceri" label="Înapoi la afaceri" />
      </div>

      {launch && <LaunchBusinessCard details={launch} businessId={id} admin />}
      <BusinessAdminPanel
        platformSmsReady={platformSmsReady}
        campaignManaged={campaignManaged}
        billingMode={billingMode}
        currentCampaignId={enrollment?.campaignId ?? null}
        campaigns={promotions.map(campaign => ({ id: campaign.id, code: campaign.code, name: campaign.name, freeMonths: campaign.freeMonths, open: promotionIsOpen(campaign) }))}
        business={{
          id: business.id,
          slug: business.slug,
          name: business.name,
          category: business.category,
          dentalClinic: business.dentalClinic,
          accountActive: business.accountActive,
          publicListed: business.publicListed,
          ownerEmail: business.users[0]?.email ?? null,
          bookingsCount: business._count.bookings,
          planName: business.planName,
          teamSize: business.teamSize,
          billingStatus: business.billingStatus,
          billingNote: business.billingNote,
          billingAmount: business.billingAmount === null ? null : Number(business.billingAmount),
          billingSubtotal: business.billingSubtotal === null ? null : Number(business.billingSubtotal),
          billingVatRate: Number(business.billingVatRate),
          billingDueAt: business.billingDueAt?.toISOString() ?? null,
          billingInvoiceName: business.billingInvoiceName,
          billingIpayPaymentState: business.billingIpayPaymentState,
          billingIpayPaymentError: business.billingIpayPaymentError,
          billingPaidAt: business.billingPaidAt?.toISOString() ?? null,
          billingLegalName: business.billingLegalName,
          billingClientType: business.billingClientType,
          billingCif: business.billingCif,
          billingRegCom: business.billingRegCom,
          billingAddress: business.billingAddress,
          billingCounty: business.billingCounty,
          billingCity: business.billingCity,
          billingPostalCode: business.billingPostalCode,
          billingEmail: business.billingEmail ?? business.users[0]?.email ?? null,
          contractRepresentativeName: business.contractRepresentativeName,
          contractRepresentativeRole: business.contractRepresentativeRole,
          smsGatewayApiUrl: business.smsGatewayApiUrl,
          smsGatewayHasApiKey: Boolean(business.smsGatewayApiKey),
          smsGatewayDeviceId: business.smsGatewayDeviceId,
          smsGatewayPhone: business.smsGatewayPhone,
          smsGatewayEnabled: business.smsGatewayEnabled,
          smsGatewayTestedAt: business.smsGatewayTestedAt?.toISOString() ?? null,
          smsGatewayLastError: business.smsGatewayLastError,
          smsGatewayMode: business.smsGatewayMode,
          smsSenderMode: business.smsSenderMode,
          smsDevicePaired: Boolean(business.smsDeviceTokenHash),
          smsDeviceLastSeenAt: business.smsDeviceLastSeenAt?.toISOString() ?? null,
        }}
        metaAppId={process.env.META_APP_ID ?? ''}
        metaWhatsappConfigId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_V4_CONFIG_ID ?? process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID ?? ''}
        instagramOAuthEnabled={process.env.META_INSTAGRAM_OAUTH_ENABLED === 'true' && Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)}
        channels={business.channels.map((c) => ({
          id: c.id,
          type: c.type,
          externalId: c.externalId,
          displayName: c.displayName,
          authProvider: c.authProvider,
          wabaId: c.wabaId,
          status: c.status,
          enabledByOwner: c.enabledByOwner,
        }))}
        practitioners={business.practitioners.map((practitioner) => ({
          id: practitioner.id,
          name: practitioner.name,
          googleCalendar: practitioner.googleCalendar,
        }))}
      />
      <ContractAdminSection businessId={id}
        currentHashes={{ SERVICES: documentHash(buildContractDocument(business, 'SERVICES')), DPA: documentHash(buildContractDocument(business, 'DPA')) }}
        signatures={signatures.map((signed) => ({ id: signed.id, type: signed.type, hash: signed.documentHash, customerSignerName: signed.customerSignerName, customerSignedAt: signed.customerSignedAt.toISOString(), providerSignedAt: signed.providerSignedAt?.toISOString() ?? null }))} />
    </div>
  )
}
