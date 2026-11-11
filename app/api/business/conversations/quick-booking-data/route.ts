import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/business-auth'
import { calculateAdaptiveSlotStep } from '@/lib/availability'

export async function GET(req: NextRequest) {
  const session = await auth('STANDARD')
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { category: true, teamSize: true, workingHours: true, slotIntervalMinutes: true },
  })
  const isMultiPractitioner = (business?.teamSize ?? 1) > 1

  const [services, practitioners, customers] = await Promise.all([
    prisma.service.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
    req.nextUrl.searchParams.get('includeCustomers') === 'true'
      ? prisma.customer.findMany({ where: { businessId, archivedAt: null }, select: { id: true, name: true, phone: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] })
      : Promise.resolve([]),
  ])

  return NextResponse.json({
    isMultiPractitioner,
    customers,
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    practitioners: practitioners.map((p) => ({ id: p.id, name: p.name })),
    workingHours: (business?.workingHours ?? []).map((range) => ({ weekday: range.weekday, startTime: range.startTime, endTime: range.endTime })),
    slotIntervalMinutes:
      business?.category === 'EVENT_VENUE'
        ? 60
        : calculateAdaptiveSlotStep(
            services.filter((service) => service.type === 'APPOINTMENT').map((service) => service.durationMin),
            business?.slotIntervalMinutes
          ),
  })
}
