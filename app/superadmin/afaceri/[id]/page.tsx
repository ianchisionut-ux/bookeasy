import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { BackLink } from '@/components/ui/back-link'
import BusinessAdminPanel from './business-admin-panel'

export default async function SuperAdminBusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, revenueAgg] = await Promise.all([
    prisma.business.findUnique({
      where: { id },
      include: {
        channels: true,
        practitioners: {
          where: { active: true },
          orderBy: { name: 'asc' },
          include: { googleCalendar: { select: { googleEmail: true, calendarName: true, syncEnabled: true, lastError: true } } },
        },
        users: { where: { role: 'OWNER' } },
        _count: { select: { bookings: true } },
      },
    }),
    // venit estimat brut (aproximativ — sumă preț servicii pentru rezervările CONFIRMED/COMPLETED)
    // — independentă de "business", rulează în paralel; dacă afacerea nu există, pur și
    // simplu ignorăm rezultatul mai jos (cost mic, câștig real în cazul normal, frecvent)
    prisma.$queryRaw<Array<{ totalRevenue: unknown }>>`
      SELECT COALESCE(SUM(service.price), 0) AS "totalRevenue"
      FROM "Booking" booking
      INNER JOIN "Service" service ON service.id = booking."serviceId"
      WHERE booking."businessId" = ${id}
        AND booking.status IN ('CONFIRMED', 'COMPLETED')
    `,
  ])

  if (!business) notFound()

  const totalRevenue = Number(revenueAgg[0]?.totalRevenue ?? 0)

  return (
    <div className="p-4 lg:p-8 max-w-6xl">
      <div className="mb-4">
        <BackLink href="/superadmin/afaceri" label="Înapoi la afaceri" />
      </div>

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
          teamSize: business.teamSize,
          billingStatus: business.billingStatus,
          billingNote: business.billingNote,
          billingAmount: business.billingAmount === null ? null : Number(business.billingAmount),
          billingSubtotal: business.billingSubtotal === null ? null : Number(business.billingSubtotal),
          billingVatRate: Number(business.billingVatRate),
          billingDueAt: business.billingDueAt?.toISOString() ?? null,
          billingInvoiceName: business.billingInvoiceName,
          billingLegalName: business.billingLegalName,
          billingClientType: business.billingClientType,
          billingCif: business.billingCif,
          billingRegCom: business.billingRegCom,
          billingAddress: business.billingAddress,
          billingCounty: business.billingCounty,
          billingCity: business.billingCity,
          billingPostalCode: business.billingPostalCode,
          billingEmail: business.billingEmail ?? business.users[0]?.email ?? null,
        }}
        metaAppId={process.env.META_APP_ID ?? ''}
        metaWhatsappConfigId={process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID ?? ''}
        channels={business.channels.map((c) => ({
          id: c.id,
          type: c.type,
          externalId: c.externalId,
          wabaId: c.wabaId,
          status: c.status,
        }))}
        practitioners={business.practitioners.map((practitioner) => ({
          id: practitioner.id,
          name: practitioner.name,
          googleCalendar: practitioner.googleCalendar,
        }))}
      />
    </div>
  )
}
