import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2),
  contactPhone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  publicListed: z.boolean(),
  teamSize: z.number().min(1).max(200).optional(),
  slotIntervalMinutes: z.number().min(5).max(120).nullable().optional(),
  minLeadTimeMinutes: z.number().min(30).max(1440).optional(),
  break1Start: z.string().nullable().optional(),
  break1End: z.string().nullable().optional(),
  break2Start: z.string().nullable().optional(),
  break2End: z.string().nullable().optional(),
  break3Start: z.string().nullable().optional(),
  break3End: z.string().nullable().optional(),
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

  // re-geocodificăm doar dacă adresa sau orașul chiar s-au schimbat față de ce era
  // salvat — evită apeluri API inutile la fiecare simplă salvare de setări
  const current = await prisma.business.findUnique({ where: { id: businessId } })
  const addressChanged = current && (current.address !== businessData.address || current.city !== businessData.city)

  let coords: { lat: number; lng: number } | null = null
  if (addressChanged && businessData.address && businessData.city) {
    coords = await geocodeAddress(businessData.address, businessData.city)
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      ...businessData,
      ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
    },
  })

  await prisma.workingHours.deleteMany({ where: { businessId } })
  await prisma.workingHours.createMany({
    data: workingHours.filter((wh) => !wh.closed).map((wh) => ({ businessId, weekday: wh.weekday, startTime: wh.startTime, endTime: wh.endTime })),
  })

  return NextResponse.json({ success: true, geocoded: !!coords })
}
