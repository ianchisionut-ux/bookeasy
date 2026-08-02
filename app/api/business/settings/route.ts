import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2),
  contactPhone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  publicListed: z.boolean(),
  workingHours: z.array(
    z.object({ weekday: z.number(), startTime: z.string(), endTime: z.string(), closed: z.boolean() })
  ),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { workingHours, ...businessData } = parsed.data

  await prisma.business.update({ where: { id: businessId }, data: businessData })

  await prisma.workingHours.deleteMany({ where: { businessId } })
  await prisma.workingHours.createMany({
    data: workingHours.filter((wh) => !wh.closed).map((wh) => ({ businessId, weekday: wh.weekday, startTime: wh.startTime, endTime: wh.endTime })),
  })

  return NextResponse.json({ success: true })
}
