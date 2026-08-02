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

  const [bookings, customers, services, resources, blockedSlots] = await Promise.all([
    prisma.booking.findMany({
      where: {
        businessId,
        ...(status ? { status: status as any } : {}),
        ...(q
          ? { customer: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] } }
          : {}),
      },
      include: { customer: true, service: true, resource: true },
      orderBy: { startAt: 'desc' },
      take: 200,
    }),
    prisma.customer.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
    prisma.service.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
    prisma.resource.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
  ])

  return (
    <ProgramariManager
      bookings={bookings.map((b) => ({
        id: b.id,
        sequenceNumber: b.sequenceNumber,
        customerName: b.customer.name ?? b.customer.phone,
        customerId: b.customerId,
        serviceName: b.service.name,
        serviceId: b.serviceId,
        resourceName: b.resource?.name ?? null,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        status: b.status,
        channel: b.channel,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name ?? c.phone }))}
      services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin }))}
      blockedSlots={blockedSlots.map((b) => ({ startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString() }))}
      filters={{ status: status ?? '', q: q ?? '' }}
    />
  )
}
