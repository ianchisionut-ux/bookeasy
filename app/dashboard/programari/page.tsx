import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProgramariManager from './programari-manager'

export default async function ProgramariPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const { status, q } = await searchParams

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { category: true, teamSize: true } })
  const isMultiPractitioner = (business?.teamSize ?? 1) > 1

  const [bookings, customers, services, blockedSlots, practitioners] = await Promise.all([
    prisma.booking.findMany({
      where: {
        businessId,
        ...(status ? { status: status as any } : {}),
        ...(q
          ? { customer: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] } }
          : {}),
      },
      include: { customer: true, service: true, resource: true, practitioner: true },
      orderBy: { sequenceNumber: 'desc' },
      take: 200,
    }),
    prisma.customer.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
    prisma.service.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  return (
    <ProgramariManager
      category={business?.category ?? 'SALON'}
      isMultiPractitioner={isMultiPractitioner}
      bookings={bookings.map((b) => ({
        id: b.id,
        sequenceNumber: b.sequenceNumber,
        customerName: b.customer.name ?? b.customer.phone,
        customerPhone: b.customer.phone,
        customerId: b.customerId,
        serviceName: b.service.name,
        serviceId: b.serviceId,
        resourceName: b.resource?.name ?? null,
        practitionerName: b.practitioner?.name ?? null,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        status: b.status,
        channel: b.channel,
        confirmationRequestSent: b.confirmationRequestSent,
        customerConfirmed: b.customerConfirmed,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name ?? c.phone }))}
      services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin }))}
      blockedSlots={blockedSlots.map((b) => ({ startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString() }))}
      practitioners={practitioners.map((p) => ({ id: p.id, name: p.name }))}
      filters={{ status: status ?? '', q: q ?? '' }}
    />
  )
}
