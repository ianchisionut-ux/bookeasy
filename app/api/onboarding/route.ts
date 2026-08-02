import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'
import { z } from 'zod'

const stepSchemas = {
  1: z.object({
    name: z.string().min(2),
    category: z.enum(['SALON', 'EVENT_VENUE']),
    contactPhone: z.string(),
    city: z.string(),
    address: z.string().optional(),
  }),
  2: z.object({
    workingHours: z.array(z.object({ weekday: z.number(), startTime: z.string(), endTime: z.string() })),
  }),
  3: z.object({
    services: z.array(z.object({ name: z.string(), durationMin: z.number().nullable(), price: z.number().nullable() })),
  }),
} as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { step, data } = await req.json()
  const schema = stepSchemas[step as keyof typeof stepSchemas]
  if (!schema) return NextResponse.json({ error: 'invalid step' }, { status: 400 })

  const parsed = schema.safeParse(data)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const businessId = (session as any).businessId
  await saveOnboardingStep(businessId, step, parsed.data)

  await prisma.business.update({
    where: { id: businessId },
    data: { onboardingStep: step + 1, onboardingDone: step >= 4 },
  })

  return NextResponse.json({ nextStep: step + 1 })
}

async function saveOnboardingStep(businessId: string, step: number, data: any) {
  if (step === 1) {
    const coords = data.address ? await geocodeAddress(data.address, data.city) : null
    await prisma.business.update({
      where: { id: businessId },
      data: { ...data, ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}) },
    })
  }
  if (step === 2) {
    await prisma.workingHours.deleteMany({ where: { businessId } })
    await prisma.workingHours.createMany({ data: data.workingHours.map((wh: any) => ({ ...wh, businessId })) })
  }
  if (step === 3) {
    await prisma.service.createMany({ data: data.services.map((s: any) => ({ ...s, businessId })) })
  }
}
