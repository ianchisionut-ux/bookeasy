import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsForm from './settings-form'
import { PublicPageLinkCard } from './public-page-link-card'
import { SubscriptionCard } from './subscription-card'
import BrandColorCard from './brand-color-card'
import PasswordForm from './password-form'
import MessengerBotToggle from '@/components/messenger-bot-toggle'
import IntegrationsCard from './integrations-card'
import { buildContractDocument, contractMissingFields, documentHash } from '@/lib/business-contracts'
import { LegalDetailsForm } from './legal-details-form'
import { ContractCenter } from './contract-center'

// Luni primul, Duminică ultima — ordinea de afișare a programului de lucru
// (valorile 'weekday' rămân 0=Duminică...6=Sâmbătă, standardul JS getDay(), doar ordinea vizuală se schimbă)
const WEEKDAYS_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default async function SetariPage({ searchParams }: { searchParams: Promise<{ payment?: string; connected?: string; error?: string; google?: string }> }) {
  const session = await auth()
  const query = await searchParams
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const [business, channels, practitioners, signatures] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      include: { workingHours: true },
    }),
    prisma.channel.findMany({
      where: { businessId },
      select: { id: true, type: true, status: true, externalId: true, enabledByOwner: true },
      orderBy: { connectedAt: 'desc' },
    }),
    prisma.practitioner.findMany({
      where: { businessId, active: true },
      select: {
        id: true,
        name: true,
        googleCalendar: { select: { googleEmail: true, calendarName: true, syncEnabled: true, includeCustomerDetails: true, lastSyncAt: true, lastError: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.contractSignature.findMany({ where: { businessId }, orderBy: { customerSignedAt: 'desc' }, select: { id: true, type: true, documentHash: true, customerSignedAt: true, providerSignedAt: true } }),
  ])
  if (!business) redirect('/login')
  const messengerChannel = channels.find((channel) => channel.type === 'FACEBOOK' && channel.status === 'ACTIVE')

  const workingHours = WEEKDAYS_DISPLAY_ORDER.map((weekday) => {
    const existing = business.workingHours.find((wh) => wh.weekday === weekday)
    return {
      weekday,
      startTime: existing?.startTime ?? '09:00',
      endTime: existing?.endTime ?? '18:00',
      closed: !existing,
    }
  })

  return (
    <div className="dashboard-page">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Setări</h1>
          <p className="text-sm text-gray-500">Datele profilului, programul de lucru și vizibilitatea publică.</p>
        </div>
        <div id="settings-save-slot" className="flex items-center gap-3 shrink-0" />
      </div>

      <div className="columns-1 gap-5 md:columns-2 2xl:columns-3">
        <PublicPageLinkCard slug={business.slug} isClinic={business.category === 'CLINICA'} usesAppointments={business.category === 'SALON' || business.category === 'CLINICA'} />

        <SubscriptionCard
          businessId={business.id}
          planName={business.planName}
          billingStatus={business.billingStatus}
          amount={business.billingAmount === null ? null : Number(business.billingAmount)}
          currency={business.billingCurrency}
          dueAt={business.billingDueAt?.toISOString() ?? null}
          invoiceName={business.billingInvoiceName}
          paidAt={business.billingPaidAt?.toISOString() ?? null}
          paymentState={business.billingIpayPaymentState}
          paymentError={business.billingIpayPaymentError}
          paymentResult={query.payment}
        />

        <SettingsForm
          isClinic={business.category === 'CLINICA'}
          isEventVenue={business.category === 'EVENT_VENUE'}
          isMultiPractitioner={business.teamSize > 1}
          business={{
            name: business.name,
            contactPhone: business.contactPhone ?? '',
            city: business.city ?? '',
            address: business.address ?? '',
            publicListed: business.publicListed,
            slotIntervalMinutes: business.slotIntervalMinutes,
            minLeadTimeMinutes: business.minLeadTimeMinutes,
            reminderMinutesBefore: business.reminderMinutesBefore,
            operatorSilenceMinutes: business.operatorSilenceMinutes,
            botBookingEnabled: business.botBookingEnabled,
            break1Start: business.break1Start,
            break1End: business.break1End,
            break2Start: business.break2Start,
            break2End: business.break2End,
            break3Start: business.break3Start,
            break3End: business.break3End,
          }}
          workingHours={workingHours}
        />

        <BrandColorCard initialColor={business.brandColor} usesAppointments={business.category === 'SALON' || business.category === 'CLINICA'} />
        <IntegrationsCard
          channels={channels}
          practitioners={practitioners}
          businessName={business.name}
          businessCategory={business.category}
          isIndividual={business.teamSize <= 1}
          instagramOAuthEnabled={process.env.META_INSTAGRAM_OAUTH_ENABLED === 'true'}
          metaAppId={process.env.META_APP_ID ?? ''}
          metaV4ConfigId={process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_V4_CONFIG_ID ?? process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID ?? ''}
        />
        {messengerChannel && (
          <div className="card p-5 mb-5 break-inside-avoid">
            <h2 className="font-medium mb-3">Messenger</h2>
            <MessengerBotToggle channelId={messengerChannel.id} enabled={messengerChannel.enabledByOwner} />
          </div>
        )}

        <div className="card p-5 mb-5 break-inside-avoid">
          <h2 className="font-medium mb-1">Cont</h2>
          <p className="text-sm text-gray-500 mb-3">Schimbă parola pentru contul curent.</p>
          <PasswordForm />
        </div>
      </div>
      <div className="mt-5">
        <LegalDetailsForm canEdit={(session as any).role === 'OWNER' && !(session as any).isSuperAdmin} initial={{
          billingClientType: business.billingClientType,
          billingLegalName: business.billingLegalName ?? '',
          billingCif: business.billingCif ?? '',
          billingRegCom: business.billingRegCom ?? '',
          billingAddress: business.billingAddress ?? '',
          billingCounty: business.billingCounty ?? '',
          billingCity: business.billingCity ?? business.city ?? '',
          billingPostalCode: business.billingPostalCode ?? '',
          billingEmail: business.billingEmail ?? (session as any).user?.email ?? '',
          contractRepresentativeName: business.contractRepresentativeName ?? '',
          contractRepresentativeRole: business.contractRepresentativeRole ?? '',
        }} />
        <ContractCenter
          canSign={(session as any).role === 'OWNER' && !(session as any).isSuperAdmin}
          representativeName={business.contractRepresentativeName ?? ''}
          entries={(['SERVICES', 'DPA'] as const).map((type) => {
            const document = buildContractDocument(business, type)
            const latest = signatures.find((signature) => signature.type === type)
            return { type, document, hash: documentHash(document), missing: contractMissingFields(business, type), signed: latest ? {
              id: latest.id, hash: latest.documentHash,
              customerSignedAt: latest.customerSignedAt.toISOString(),
              providerSignedAt: latest.providerSignedAt?.toISOString() ?? null,
            } : null }
          })}
        />
      </div>
    </div>
  )
}
