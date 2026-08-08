import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import PractitionersManager from './practitioners-manager'

export default async function MediciPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { teamSize: true } })
  if (!business || business.teamSize <= 1) redirect('/dashboard')

  const [practitioners, services] = await Promise.all([
    prisma.practitioner.findMany({
      where: { businessId },
      include: { workingHours: true, services: { include: { service: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.service.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <PractitionersManager
      practitioners={practitioners.map((p) => ({
        id: p.id,
        name: p.name,
        specialization: p.specialization,
        bio: p.bio,
        active: p.active,
        workingHours: p.workingHours.map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime })),
        serviceIds: p.services.map((s) => s.serviceId),
        break1Start: p.break1Start,
        break1End: p.break1End,
        break2Start: p.break2Start,
        break2End: p.break2End,
        break3Start: p.break3Start,
        break3End: p.break3End,
      }))}
      services={services.map((s) => ({ id: s.id, name: s.name }))}
    />
  )
}
