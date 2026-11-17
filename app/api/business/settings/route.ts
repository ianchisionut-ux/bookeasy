import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/business-auth'
import { geocodeAddress } from '@/lib/geocode'
import { z } from 'zod'
import { canonicalCity } from '@/lib/romanian-cities'
import { businessHasPlan } from '@/lib/business-plan-access'

const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const schema = z.object({
  name: z.string().min(2),
  contactPhone: z.string().optional(),
  city: z.string().min(1),
  address: z.string().optional(),
  manualLocation: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
  publicListed: z.boolean(),
  teamSize: z.number().min(1).max(200).optional(),
  slotIntervalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]).nullable().optional(),
  minLeadTimeMinutes: z.number().min(30).max(1440).optional(),
  reminderMinutesBefore: z.number().min(15).max(2880).optional(),
  smsReconfirmationEnabled: z.boolean().optional(),
  messengerReconfirmationEnabled: z.boolean().optional(),
  operatorSilenceMinutes: z.number().min(5).max(240).optional(),
  botBookingEnabled: z.boolean().optional(),
  break1Start: timeValue.nullable().optional(),
  break1End: timeValue.nullable().optional(),
  break2Start: timeValue.nullable().optional(),
  break2End: timeValue.nullable().optional(),
  break3Start: timeValue.nullable().optional(),
  break3End: timeValue.nullable().optional(),
  workingHours: z.array(
    z.object({ weekday: z.number().int().min(0).max(6), startTime: timeValue, endTime: timeValue, closed: z.boolean() })
  ),
}).superRefine((data, ctx) => {
  const breaks = [
    [data.break1Start, data.break1End],
    [data.break2Start, data.break2End],
    [data.break3Start, data.break3End],
  ]
  breaks.forEach(([start, end], index) => {
    if (!!start !== !!end || (start && end && start >= end)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`break${index + 1}Start`], message: 'Pauza trebuie să aibă un interval valid.' })
    }
  })
  data.workingHours.forEach((range, index) => {
    if (!range.closed && range.startTime >= range.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workingHours', index], message: 'Ora de început trebuie să fie înaintea orei de final.' })
    }
  })
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const city = canonicalCity(parsed.data.city)
  if (!city) return NextResponse.json({ error: 'Alege un oraș din listă.' }, { status: 400 })

  const manualLocationProvided = Object.prototype.hasOwnProperty.call(parsed.data, 'manualLocation')
  const { workingHours, manualLocation, ...businessData } = parsed.data
  businessData.city = city

  // re-geocodificăm doar dacă adresa sau orașul chiar s-au schimbat față de ce era
  // salvat — evită apeluri API inutile la fiecare simplă salvare de setări
  const current = await prisma.business.findUnique({ where: { id: businessId } })
  if (current && !(await businessHasPlan(businessId, 'STANDARD', Boolean((session as any).isSuperAdmin)))) {
    const advancedKeys = [
      'teamSize', 'reminderMinutesBefore', 'smsReconfirmationEnabled',
      'messengerReconfirmationEnabled', 'operatorSilenceMinutes', 'botBookingEnabled',
    ] as const
    if (advancedKeys.some((key) => businessData[key] !== undefined && businessData[key] !== current[key])) {
      return NextResponse.json({ error: 'Funcția necesită planul Standard.' }, { status: 403 })
    }
  }
  if (current?.category === 'FITNESS') businessData.teamSize = 1
  const addressChanged = current && (current.address !== businessData.address || current.city !== businessData.city)
  const shouldUpdateLocation = manualLocationProvided || !!addressChanged

  let coords: { lat: number; lng: number } | null = null
  if (manualLocationProvided) {
    coords = manualLocation ?? null
  } else if (addressChanged && businessData.city) {
    coords = await geocodeAddress(businessData.address || '', businessData.city)
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        ...businessData,
        ...(shouldUpdateLocation ? { latitude: coords?.lat ?? null, longitude: coords?.lng ?? null } : {}),
      },
    })
    await tx.workingHours.deleteMany({ where: { businessId } })
    await tx.workingHours.createMany({
      data: workingHours.filter((wh) => !wh.closed).map((wh) => ({ businessId, weekday: wh.weekday, startTime: wh.startTime, endTime: wh.endTime })),
    })
  })

  const location = shouldUpdateLocation
    ? coords
    : current?.latitude != null && current?.longitude != null
      ? { lat: current.latitude, lng: current.longitude }
      : null
  return NextResponse.json({ success: true, geocoded: !!coords, location })
}
