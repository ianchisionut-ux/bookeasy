import { ensureReadablePublicSlug } from '@/lib/business-public-slug'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsForm from './settings-form'
import { PublicPageLinkCard } from './public-page-link-card'
import { SubscriptionCard } from './subscription-card'
import BrandColorCard from './brand-color-card'
import PasswordForm from './password-form'
import IntegrationsCard from './integrations-card'
import { buildContractDocument, contractMissingFields, documentHash } from '@/lib/business-contracts'
import { LegalDetailsForm } from './legal-details-form'
import { ContractCenter } from './contract-center'
import { isPatientCategory } from '@/lib/business-categories';
import { instagramLoginConfigured } from '@/lib/instagram-login'
import { getLaunchDetails, refreshLaunchIfDue } from '@/lib/launch-campaign'
import { LaunchBusinessCard } from '@/components/launch-campaign-card'
import AccountDeletionCard from '@/components/account-deletion-card'
import { effectiveBusinessPlan } from '@/lib/business-plans'
import Link from 'next/link'
import { isPlatformSmsReady } from '@/lib/sms-routing'
import ServicesManager from '../servicii/services-manager'
import BusinessPhotosUploader from '@/components/business-photos-uploader'

// Luni primul, Duminică ultima — ordinea de afișare a programului de lucru
// (valorile 'weekday' rămân 0=Duminică...6=Sâmbătă, standardul JS getDay(), doar ordinea vizuală se schimbă)
const WEEKDAYS_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default async function SetariPage({ searchParams }: { searchParams: Promise<{ payment?: string; connected?: string; error?: string; google?: string }> }) {
  const session = await auth()
  const query = await searchParams
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')
  await refreshLaunchIfDue(businessId)
  await ensureReadablePublicSlug(businessId)

  const [business, channels, practitioners, signatures, platformSmsReady] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      include: { workingHours: true, services: { orderBy: { name: 'asc' } }, resources: { orderBy: { name: 'asc' } }, photos: { orderBy: { createdAt: 'desc' } }, launchEnrollment: { select: { cancelledAt: true } }, _count: { select: { services: { where: { active: true } } } } },
    }),
    prisma.channel.findMany({
      where: { businessId },
      select: { id: true, type: true, status: true, externalId: true, displayName: true, authProvider: true, enabledByOwner: true },
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
    isPlatformSmsReady(),
  ])
  if (!business) redirect('/login')
  const currentPlan = effectiveBusinessPlan(business, Boolean((session as any).isSuperAdmin))
  const launch = await getLaunchDetails(businessId)
  const freePeriod = launch?.managed && (launch.stage === 'FREE' || launch.stage === 'ONBOARDING') || business.billingStatus === 'GRATUIT'

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
        <div id="servicii" className="mb-5 break-inside-avoid scroll-mt-6">
          <ServicesManager showServicePrices={business.showServicePrices} category={business.category} services={business.services.map(service => ({ id: service.id, name: service.name, durationMin: service.durationMin, price: service.price ? Number(service.price) : null, active: service.active }))} resources={business.resources.map(resource => ({ id: resource.id, name: resource.name, capacity: resource.capacity, basePrice: resource.basePrice ? Number(resource.basePrice) : null }))} />
        </div>
        <div className="mb-5 break-inside-avoid">
          <BusinessPhotosUploader heroImageUrl={business.heroImageUrl} gallery={business.photos.map(photo => ({ id: photo.id, url: photo.url }))} />
        </div>
        {launch && <div className="break-inside-avoid"><LaunchBusinessCard details={launch} businessId={businessId} /></div>}
        <PublicPageLinkCard businessName={business.name} canEdit={(session as any).role === 'OWNER'} slug={business.slug} category={business.category} isClinic={isPatientCategory(business.category)} publicListed={business.publicListed} accountActive={business.accountActive} onboardingDone={business.onboardingDone} onboardingStep={business.onboardingStep} activeServiceCount={business._count.services} />

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
          smsAvailable={Boolean(platformSmsReady && business.smsGatewayEnabled && business.accountActive)}
          advancedLocked={currentPlan === 'FREE'}
          category={business.category}
          isClinic={isPatientCategory(business.category)}
          isEventVenue={business.category === 'EVENT_VENUE'}
          isMultiPractitioner={business.category !== 'FITNESS' && business.teamSize > 1}
          business={{
            name: business.name,
            contactPhone: business.contactPhone ?? '',
            city: business.city ?? '',
            address: business.address ?? '',
            latitude: business.latitude,
            longitude: business.longitude,
            publicListed: business.publicListed,
            slotIntervalMinutes: business.slotIntervalMinutes,
            minLeadTimeMinutes: business.minLeadTimeMinutes,
            reminderMinutesBefore: business.reminderMinutesBefore,
            smsReconfirmationEnabled: business.smsReconfirmationEnabled,
            messengerReconfirmationEnabled: business.messengerReconfirmationEnabled,
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

        {currentPlan === 'FREE' ? <div className="card mb-5 break-inside-avoid border border-[#bde3da] bg-[#f4fbf9] p-5">
          <span className="rounded-full bg-[#d9f1e9] px-2.5 py-1 text-xs font-bold text-[#107973]">STANDARD</span>
          <h2 className="mt-3 font-semibold">Culoarea și identitatea paginii</h2>
          <p className="mt-2 text-sm text-gray-600">Personalizează aspectul paginii publice în planul Standard.</p>
          <Link href="/dashboard/planuri" className="mt-3 inline-block text-sm font-semibold text-[#147f83] underline">Vezi opțiunile de upgrade</Link>
        </div> : <BrandColorCard initialColor={business.brandColor} category={business.category} />}
        {currentPlan === 'FREE' ? <div className="card mb-5 break-inside-avoid border border-[#bde3da] bg-[#f4fbf9] p-5">
          <span className="rounded-full bg-[#d9f1e9] px-2.5 py-1 text-xs font-bold text-[#107973]">STANDARD</span>
          <h2 className="mt-3 font-semibold">Integrări și canale</h2>
          <p className="mt-2 text-sm text-gray-600">Conectează Google Calendar, mesageria și celelalte integrări disponibile pentru afacerea ta.</p>
          <Link href="/dashboard/planuri" className="mt-3 inline-block text-sm font-semibold text-[#147f83] underline">Vezi opțiunile de upgrade</Link>
        </div> : <IntegrationsCard
          platformSmsReady={platformSmsReady}
          channels={channels}
          practitioners={practitioners}
          businessName={business.name}
          businessCategory={business.category}
          isIndividual={business.category === 'FITNESS' || business.teamSize <= 1}
          instagramOAuthEnabled={instagramLoginConfigured()}
          smsGateway={{ apiUrl: business.smsGatewayApiUrl, hasApiKey: Boolean(business.smsGatewayApiKey), deviceId: business.smsGatewayDeviceId, phone: business.smsGatewayPhone, enabled: business.smsGatewayEnabled, testedAt: business.smsGatewayTestedAt, lastError: business.smsGatewayLastError, mode: business.smsGatewayMode, paired: Boolean(business.smsDeviceTokenHash), lastSeenAt: business.smsDeviceLastSeenAt }}
        />}

        <div className="card p-5 mb-5 break-inside-avoid">
          <h2 className="font-medium mb-1">Cont</h2>
          <p className="text-sm text-gray-500 mb-3">Schimbă parola pentru contul curent.</p>
          <PasswordForm />
        </div>
      </div>
      {!freePeriod && <div className="mt-5">
        <LegalDetailsForm canEdit={(session as any).role === 'OWNER' && !(session as any).isSuperAdmin} initial={{
          billingClientType: business.billingClientType,
          billingLegalName: business.billingLegalName ?? '',
          billingCif: business.billingCif ?? '',
          billingRegCom: business.billingRegCom ?? '',
          billingAddress: business.billingAddress ?? '',
          billingCounty: business.billingCounty ?? '',
          billingCity: business.billingCity ?? '',
          billingPostalCode: business.billingPostalCode ?? '',
          billingEmail: business.billingEmail ?? '',
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
      </div>}
      {(session as any).role === 'OWNER' && !(session as any).isSuperAdmin && !(session as any).isImpersonatingBusiness && <div className="card mt-6 p-5"><AccountDeletionCard kind="business" accountName={business.name} /></div>}
    </div>
  )
}
