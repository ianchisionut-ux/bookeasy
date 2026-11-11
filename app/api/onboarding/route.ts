import { setPublicSlug } from '@/lib/business-public-slug'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/business-auth'
import { geocodeAddress } from '@/lib/geocode'
import { ensureVenueService } from '@/lib/venue-services'
import { z } from 'zod'
import { canonicalCity } from '@/lib/romanian-cities'
import { PUBLIC_CATEGORIES, isAppointmentCategory } from '@/lib/business-categories'
import { LaunchSignupError, activateLaunch, activateStandardSubscription, launchSignupData, lockLaunchBusiness } from '@/lib/launch-campaign'
import {hasOpenPromotion} from '@/lib/promotion-campaigns'

const stepSchemas = {
  1: z.object({
    name: z.string().min(2),
    category: z.enum(PUBLIC_CATEGORIES).optional(),
    contactPhone: z.string(),
    city: z.string().min(1),
    address: z.string().optional(),
  }),
  2: z.object({
    workingHours: z.array(z.object({ weekday: z.number(), startTime: z.string(), endTime: z.string() })),
  }),
  3: z.object({
    services: z.array(
      z.object({
        name: z.string(),
        durationMin: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
        capacity: z.number().nullable().optional(),
      })
    ),
  }),
  4: z.object({
    staff: z.array(z.object({ name: z.string() })).optional().default([]),
  }),
  5: z.object({ promoCode: z.string().trim().max(64).optional(), acceptLaunchTerms: z.boolean().optional(), launchOfferVersion: z.string().optional() }),
} as const

// GET — folosit de paginile de onboarding ca să știe categoria aleasă la pasul 1
// (necesar la pasul 3, unde formularul diferă radical între SALON și EVENT_VENUE)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const [enrollment, campaign] = await Promise.all([
    prisma.launchEnrollment.findUnique({ where: { businessId }, select: { freeMonths: true, cancelledAt: true } }),
    hasOpenPromotion(),
  ])
  return NextResponse.json({
    category: business.category,
    onboardingStep: business.onboardingStep,
    onboardingDone: business.onboardingDone,
    freeMonths: enrollment && !enrollment.cancelledAt ? enrollment.freeMonths : 0,
    launchOpen: campaign,
  })
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă. Reîncarcă pagina.' }, { status: 403 })
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const envelope = z.object({ step: z.number().int().min(1).max(5), data: z.unknown().optional() }).safeParse(await req.json().catch(() => null))
  if (!envelope.success) return NextResponse.json({ error: 'Pas invalid.' }, { status: 400 })
  const { step, data } = envelope.data
  const schema = stepSchemas[step as keyof typeof stepSchemas]
  if (!schema) return NextResponse.json({ error: 'invalid step' }, { status: 400 })

  const parsed = schema.safeParse(data ?? {})
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const businessId = (session as any).businessId
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { categoryLocked: true, category: true, onboardingDone: true, city: true, _count: { select: { services: true, resources: true, workingHours: true } } } })
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (business.onboardingDone) return NextResponse.json(step === 5 ? { nextStep: 6 } : { error: 'Configurarea este finalizată. Folosește pagina Setări.' }, { status: step === 5 ? 200 : 409 })
  if (step === 5 && (!business.city || business._count.workingHours === 0)) return NextResponse.json({ error: 'Completează orașul și programul înainte de activare.' }, { status: 400 })

  if (step === 3 && isAppointmentCategory(business.category)) {
    const items = (parsed.data as { services: { durationMin?: number | null }[] }).services
    if (items.some((item) => !item.durationMin || item.durationMin < 5 || item.durationMin > 1440)) {
      return NextResponse.json({ error: 'Completează durata fiecărui serviciu (între 5 și 1440 de minute) pentru calculul orelor disponibile.' }, { status: 400 })
    }
  }

  if (step === 1) {
    const stepData = parsed.data as { city: string; category?: string }
    const city = canonicalCity(stepData.city)
    if (!city) return NextResponse.json({ error: 'Alege un oraș din listă.' }, { status: 400 })
    await saveOnboardingStep(businessId, step, { ...stepData, city, ...(business.categoryLocked ? { category: undefined } : {}) })
  } else {
    await saveOnboardingStep(businessId, step, parsed.data)
  }

  try {
  await prisma.$transaction(async tx => {
  if (step === 5) {
    await lockLaunchBusiness(tx, businessId)
    const current = await tx.business.findUnique({ where: { id: businessId }, select: { onboardingDone: true } })
    if (current?.onboardingDone) return
    const finalData = parsed.data as z.infer<typeof stepSchemas[5]>
    if (finalData.promoCode) {
      if (await tx.launchEnrollment.findUnique({ where: { businessId }, select: { id: true } })) throw new LaunchSignupError('Această afacere are deja o ofertă asociată. Continuă fără un cod nou.', 409)
      const offer = await launchSignupData(finalData.promoCode, tx,finalData.launchOfferVersion??'')
      if (finalData.acceptLaunchTerms !== true) throw new LaunchSignupError('Acceptă condițiile codului promoțional.')
      await tx.business.update({ where: { id: businessId }, data: offer })
    }
  }
  await tx.business.updateMany({
    where: { id: businessId, onboardingDone: false },
    data: {
      onboardingStep: Math.min(step + 1, 5),
      onboardingDone: step >= 5,
      ...(business.category === 'FITNESS' ? { teamSize: 1 } : {}),
      ...(step >= 5 ? { publicListed: true } : {}),
    },
  })
  if (step === 5) {
    const now = new Date()
    await activateLaunch(tx, businessId, now)
    await activateStandardSubscription(tx, businessId, now)
  }
  })
  } catch (error) {
    if (error instanceof LaunchSignupError) return NextResponse.json({ error: error.message }, { status: error.status })
    throw error
  }

  return NextResponse.json({ nextStep: step + 1 })
}

async function saveOnboardingStep(businessId: string, step: number, data: any) {
  if (step === 1) {
    const coords = await geocodeAddress(data.address || '', data.city)
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(21420261031::bigint)`
      const current = await tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { slug: true } })
      if (/-[a-f0-9]{12}$/.test(current.slug)) await setPublicSlug(tx, businessId, data.name, true)
      await tx.business.update({ where: { id: businessId }, data: { ...data, ...(data.category === 'FITNESS' ? { teamSize: 1 } : {}), ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}) } })
    })
  }

  if (step === 2) {
    await prisma.workingHours.deleteMany({ where: { businessId } })
    await prisma.workingHours.createMany({ data: data.workingHours.map((wh: any) => ({ ...wh, businessId })) })
  }

  if (step === 3) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (business?.category === 'EVENT_VENUE') {
      await prisma.resource.createMany({
        data: data.services.map((s: any) => ({ businessId, name: s.name, capacity: s.capacity ?? null, basePrice: s.price ?? null })),
      })
      const resources = await prisma.resource.findMany({ where: { businessId } })
      await Promise.all(resources.map((resource) => ensureVenueService(resource)))
    } else {
      await prisma.service.createMany({
        data: data.services.map((s: any) => ({
          businessId,
          name: s.name,
          type: 'APPOINTMENT',
          durationMin: s.durationMin ?? null,
          price: s.price ?? null,
        })),
      })
    }
  }

  if (step === 4 && data.staff?.length) {
    await prisma.staff.createMany({ data: data.staff.map((s: any) => ({ businessId, name: s.name })) })
  }

  // pasul 5 nu are date proprii — doar finalizează onboarding-ul (vezi POST handler)
}
