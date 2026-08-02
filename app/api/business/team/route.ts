import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({ teamSize: z.number().min(1).max(200) })

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { teamSize } = parsed.data

  await prisma.business.update({ where: { id: businessId }, data: { teamSize } })

  const activeStaff = await prisma.staff.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: 'asc' },
  })

  if (activeStaff.length < teamSize) {
    // creăm sloturi noi, cu nume placeholder editabile ulterior
    const toCreate = teamSize - activeStaff.length
    await prisma.staff.createMany({
      data: Array.from({ length: toCreate }, (_, i) => ({
        businessId,
        name: `Profesionist ${activeStaff.length + i + 1}`,
        active: true,
      })),
    })
  } else if (activeStaff.length > teamSize) {
    // dezactivăm cei mai recent adăugați, în exces — istoricul de rezervări rămâne intact
    const excess = activeStaff.slice(teamSize).map((s) => s.id)
    await prisma.staff.updateMany({ where: { id: { in: excess } }, data: { active: false } })
  }

  const staff = await prisma.staff.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { bookings: true } } },
  })

  return NextResponse.json({
    staff: staff.map((s) => ({ id: s.id, name: s.name, bookingsCount: s._count.bookings })),
  })
}
