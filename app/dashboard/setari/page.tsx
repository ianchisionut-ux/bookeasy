import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsForm from './settings-form'
import { PublicPageLinkCard } from './public-page-link-card'
import { SubscriptionCard } from './subscription-card'
import BrandColorCard from './brand-color-card'

// Luni primul, Duminică ultima — ordinea de afișare a programului de lucru
// (valorile 'weekday' rămân 0=Duminică...6=Sâmbătă, standardul JS getDay(), doar ordinea vizuală se schimbă)
const WEEKDAYS_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default async function SetariPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { workingHours: true },
  })
  if (!business) redirect('/login')

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
    <div className="p-4 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Setări</h1>
      <p className="text-sm text-gray-500 mb-6">Datele profilului, programul de lucru și vizibilitatea publică.</p>

      <div className="flex flex-col gap-5">
        <PublicPageLinkCard slug={business.slug} isClinic={business.category === 'CLINICA'} />

        <SubscriptionCard planName={business.planName} billingStatus={business.billingStatus} />

        <SettingsForm
          isClinic={business.category === 'CLINICA'}
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

        <BrandColorCard initialColor={business.brandColor} isClinic={business.category === 'CLINICA'} />
      </div>
    </div>
  )
}
