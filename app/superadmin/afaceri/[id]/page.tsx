import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { BackLink } from '@/components/ui/back-link'
import BusinessAdminPanel from './business-admin-panel'
import BillingSection from './billing-section'

export default async function SuperAdminBusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      channels: true,
      users: { where: { role: 'OWNER' } },
      _count: { select: { bookings: true } },
    },
  })

  if (!business) notFound()

  // venit estimat brut (aproximativ — sumă preț servicii pentru rezervările CONFIRMED/COMPLETED)
  const revenueAgg = await prisma.booking.findMany({
    where: { businessId: id, status: { in: ['CONFIRMED', 'COMPLETED'] } },
    include: { service: true },
  })
  const totalRevenue = revenueAgg.reduce((sum, b) => sum + Number(b.service.price ?? 0), 0)

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="mb-4">
        <BackLink href="/superadmin/afaceri" label="Înapoi la afaceri" />
      </div>

      <div className="flex flex-col gap-5">
        <BusinessAdminPanel
          business={{
            id: business.id,
            slug: business.slug,
            name: business.name,
            category: business.category,
            accountActive: business.accountActive,
            publicListed: business.publicListed,
            ownerEmail: business.users[0]?.email ?? null,
            bookingsCount: business._count.bookings,
            revenue: totalRevenue,
            planName: business.planName,
          }}
          channels={business.channels.map((c) => ({
            id: c.id,
            type: c.type,
            externalId: c.externalId,
            wabaId: c.wabaId,
            status: c.status,
          }))}
        />

        <BillingSection
          businessId={business.id}
          initialPlanName={business.planName}
          initialStatus={business.billingStatus}
          initialNote={business.billingNote}
        />
      </div>
    </div>
  )
}
