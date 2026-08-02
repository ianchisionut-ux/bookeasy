import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SettingsForm from './settings-form'
import { PublicPageLinkCard } from './public-page-link-card'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export default async function SetariPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { workingHours: true },
  })
  if (!business) redirect('/login')

  const workingHours = WEEKDAYS.map((weekday) => {
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
      <p className="text-sm text-gray-500 mb-6">Datele afacerii, programul de lucru și vizibilitatea publică.</p>

      <div className="flex flex-col gap-5">
        <PublicPageLinkCard slug={business.slug} />

        <SettingsForm
          business={{
            name: business.name,
            contactPhone: business.contactPhone ?? '',
            city: business.city ?? '',
            address: business.address ?? '',
            publicListed: business.publicListed,
            teamSize: business.teamSize,
          }}
          workingHours={workingHours}
        />
      </div>
    </div>
  )
}
