import { isBookingConflict } from '@/lib/booking-conflict'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  getDaySlotsWithStatus,
  getPractitionerDaySlotsWithStatus,
  getVenueDaySlotsWithStatus,
  isSlotStillAvailable,
  isIntervalBlocked,
  isWithinLeadTime,
  isPractitionerSlotStillAvailable,
  isWithinWorkingHours,
} from '@/lib/availability'
import { venueServiceId } from '@/lib/venue-services'
import { getNextSequenceNumber } from '@/lib/booking-number'
import { syncBookingToGoogle } from '@/lib/google-calendar'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { clientIdentity, saveBookingClientProfile } from '@/lib/client-profile'
import { canonicalCustomerPhone } from '@/lib/customer-phone'
import { findCustomerByPhone } from '@/lib/customer-lookup'
import { createHash, randomBytes } from 'node:crypto'
import { createBookingWalletLink } from '@/lib/google-wallet'

const schema = z.object({
  businessId: z.string(),
  serviceId: z.string(),
  practitionerId: z.string().optional(),
  resourceId: z.string().optional(),
  durationMinutes: z.number().int().min(60).max(720).optional(),
  startAt: z.string(),
  customerName: z.string().trim().min(1).max(181),
  customerPhone: z.string().trim().max(30).refine((value) => /^\d{7,15}$/.test(value.replace(/[^\d]/g, ''))).transform(canonicalCustomerPhone),
  customerEmail: z.string().trim().email().max(254).optional(),
  paymentMethod: z.enum(['CASH', 'ONLINE']).optional(),
  reschedule: z.object({ bookingId: z.string().min(1), token: z.string().uuid() }).optional(),
})

class RescheduleConflict extends Error {}

export async function POST(req: NextRequest) {
  try {
  const ip = getClientIp(req)
  const { allowed } = await rateLimit(`public-booking:${ip}`, 5, 10 * 60 * 1000) // 5 rezervări / 10 min / IP
  if (!allowed) {
    return NextResponse.json({ error: 'Prea multe încercări. Așteaptă câteva minute și încearcă din nou.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide, verifică formularul.' }, { status: 400 })

  const { businessId, serviceId, practitionerId, resourceId: requestedResourceId, customerName, customerPhone, paymentMethod } = parsed.data
  if (paymentMethod === 'ONLINE') return NextResponse.json({ error: 'Plata online este dezactivată. Fă rezervarea fără plată online.' }, { status: 410 })

  const business = await prisma.business.findUnique({ where: { id: businessId }, include: { launchEnrollment: { select: { cancelledAt: true } } } })
  if (!business || !business.publicListed || !business.accountActive) {
    return NextResponse.json({ error: 'Afacerea nu este disponibilă pentru rezervări.' }, { status: 404 })
  }

  const reschedule = parsed.data.reschedule
  if (reschedule) {
    const previous = await prisma.booking.findUnique({
      where: { id: reschedule.bookingId },
      select: { businessId: true, status: true, startAt: true, confirmationRequestToken: true, confirmationRequestSent: true, customerConfirmed: true },
    })
    if (!previous || previous.businessId !== businessId || previous.confirmationRequestToken !== reschedule.token ||
        !previous.confirmationRequestSent || previous.customerConfirmed !== null ||
        !['PENDING', 'CONFIRMED'].includes(previous.status) || previous.startAt <= new Date()) {
      return NextResponse.json({ error: 'Linkul de reprogramare nu mai este valabil.' }, { status: 409 })
    }
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || service.businessId !== businessId || !service.active) {
    return NextResponse.json({ error: 'Serviciul nu mai este disponibil.' }, { status: 404 })
  }

  if (practitionerId) {
    const practitioner = await prisma.practitioner.findUnique({ where: { id: practitionerId } })
    if (!practitioner || practitioner.businessId !== businessId || !practitioner.active) {
      return NextResponse.json({ error: 'Persoana aleasă nu mai este disponibilă.' }, { status: 404 })
    }
  }

  const startAt = new Date(parsed.data.startAt)
  if (!Number.isFinite(startAt.getTime()) || startAt < new Date()) {
    return NextResponse.json({ error: 'Nu poți rezerva un interval din trecut.' }, { status: 400 })
  }
  const venueDuration = parsed.data.durationMinutes ?? 60
  if (service.type === 'VENUE_RENTAL' && venueDuration % 60 !== 0) {
    return NextResponse.json({ error: 'Durata închirierii trebuie selectată în ore întregi.' }, { status: 400 })
  }
  const durationMinutes = service.type === 'VENUE_RENTAL' ? venueDuration : (service.durationMin ?? 30)
  const endAt = new Date(startAt.getTime() + durationMinutes * 60000)
  const localDateParam = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(startAt)
  const bookingDay = new Date(`${localDateParam}T00:00:00Z`)

  // verificare finală "ultima clipă" — cineva ar fi putut ocupa slotul chiar acum
  if (await isIntervalBlocked(businessId, startAt, endAt)) {
    return NextResponse.json({ error: 'Ne pare rău, intervalul tocmai a fost ocupat. Alege altă oră.' }, { status: 409 })
  }

  let resourceId: string | null = null

  if (service.type === 'APPOINTMENT') {
    if (await isWithinLeadTime(businessId, startAt)) {
      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { minLeadTimeMinutes: true } })
      const hours = Math.round((business?.minLeadTimeMinutes ?? 120) / 60)
      return NextResponse.json(
        { error: `Rezervările online se fac cu minim ${hours} ${hours === 1 ? 'oră' : 'ore'} înainte. Sună direct pentru intervale mai apropiate.` },
        { status: 400 }
      )
    }

    const offeredSlots = practitionerId
      ? await getPractitionerDaySlotsWithStatus(businessId, serviceId, practitionerId, bookingDay)
      : await getDaySlotsWithStatus(businessId, serviceId, bookingDay)
    const wasOffered = offeredSlots.some((slot) => slot.available && new Date(slot.time).getTime() === startAt.getTime())
    if (!wasOffered) {
      return NextResponse.json({ error: 'Ora aleasă nu face parte din intervalele disponibile. Alege una dintre orele afișate.' }, { status: 409 })
    }

    const stillFree = practitionerId
      ? await isPractitionerSlotStillAvailable(businessId, serviceId, practitionerId, startAt)
      : await isSlotStillAvailable(businessId, serviceId, startAt)

    if (!stillFree) {
      return NextResponse.json({ error: 'Ne pare rău, intervalul tocmai a fost ocupat. Alege altă oră.' }, { status: 409 })
    }
  } else {
    if (!requestedResourceId || serviceId !== venueServiceId(requestedResourceId)) {
      return NextResponse.json({ error: 'Alege sala pe care vrei să o rezervi.' }, { status: 400 })
    }
    const resource = await prisma.resource.findFirst({
      where: {
        id: requestedResourceId,
        businessId,
      },
    })
    if (!resource) {
      return NextResponse.json({ error: 'Ne pare rău, data tocmai a fost ocupată. Alege altă zi.' }, { status: 409 })
    }
    const offeredSlots = await getVenueDaySlotsWithStatus(businessId, requestedResourceId, bookingDay, venueDuration)
    const wasOffered = offeredSlots.some((slot) => slot.available && new Date(slot.time).getTime() === startAt.getTime())
    if (!wasOffered) {
      return NextResponse.json({ error: 'Ora aleasă nu face parte din intervalele disponibile. Alege una dintre orele afișate.' }, { status: 409 })
    }
    if (await isWithinLeadTime(businessId, startAt)) {
      return NextResponse.json({ error: 'Rezervarea este prea apropiată de ora curentă. Alege un interval ulterior.' }, { status: 400 })
    }
    if (!(await isWithinWorkingHours(businessId, null, startAt, endAt))) {
      return NextResponse.json({ error: 'Intervalul este în afara programului de lucru sau se suprapune peste o pauză.' }, { status: 409 })
    }
    const conflict = await prisma.booking.findFirst({
      where: { resourceId: requestedResourceId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
      select: { id: true },
    })
    if (conflict) return NextResponse.json({ error: 'Sala este deja rezervată în acest interval. Alege altă oră.' }, { status: 409 })
    resourceId = resource.id
  }

  // clientul de pe web e identificat după telefon, la fel ca pe WhatsApp — dacă a mai
  // rezervat vreodată (indiferent de canal), îl recunoaștem pe același număr
  const session = await auth()
  const identity = clientIdentity(session)
  const customerEmail = identity?.email ?? parsed.data.customerEmail
  const profile = identity ? await saveBookingClientProfile(identity, customerName, customerPhone) : null
  const existingCustomer = await findCustomerByPhone(businessId, customerPhone)
  const customer = await prisma.customer.upsert({
    where: existingCustomer ? { id: existingCustomer.id } : { businessId_phone: { businessId, phone: customerPhone } },
    create: { businessId, name: customerName, phone: customerPhone, email: customerEmail },
    update: { archivedAt: null }, // O rezervare nouă readuce fișa în lista activă fără a schimba datele existente.
  })

  const sequenceNumber = await getNextSequenceNumber(businessId)
  const reviewerGoogleSub = (session as any)?.role === 'CUSTOMER' && typeof (session as any)?.googleSub === 'string'
    ? (session as any).googleSub as string
    : null
  const arrivalToken = randomBytes(32).toString('hex')

  const bookingData = {
    businessId,
    customerId: customer.id,
    contactName: customerName,
    contactEmail: customerEmail ?? null,
    clientProfileId: profile?.id ?? null,
    reviewerGoogleSub,
    arrivalTokenHash: createHash('sha256').update(arrivalToken).digest('hex'),
    serviceId,
    resourceId,
    practitionerId: practitionerId ?? null,
    startAt,
    endAt,
    status: 'PENDING' as const,
    channel: 'WEB' as const,
    sequenceNumber,
    confirmationSeenByAdmin: false,
  }
  const booking = reschedule
    ? await prisma.$transaction(async (tx) => {
        const changed = await tx.booking.updateMany({
          where: {
            id: reschedule.bookingId,
            businessId,
            confirmationRequestToken: reschedule.token,
            confirmationRequestSent: true,
            customerConfirmed: null,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startAt: { gt: new Date() },
          },
          data: { status: 'CANCELLED', customerConfirmed: false, confirmationSeenByAdmin: false },
        })
        if (changed.count !== 1) throw new RescheduleConflict()
        // Dacă rezervarea nouă e respinsă (inclusiv de protecția la suprapuneri),
        // tranzacția restaurează automat rezervarea veche.
        return tx.booking.create({ data: bookingData })
      })
    : await prisma.booking.create({ data: bookingData })
  if (reschedule) await syncBookingToGoogle(reschedule.bookingId).catch((error) => console.error('[google-calendar] sync rescheduled booking:', error))
  await syncBookingToGoogle(booking.id).catch((error) => console.error('[google-calendar] sync public booking:', error))

  let walletUrl: string | null = null
  try {
    walletUrl = await createBookingWalletLink({ id: booking.id, startAt: booking.startAt, endAt: booking.endAt, serviceName: service.name, business }, req.nextUrl.origin)
  } catch (error) {
    console.error('[google-wallet] unable to prepare booking pass:', error)
  }


  return NextResponse.json({
    bookingId: booking.id,
    walletUrl,
    arrival: business.latitude !== null && business.longitude !== null
      ? { token: arrivalToken, startAt: booking.startAt.toISOString() }
      : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof RescheduleConflict) return NextResponse.json({ error: 'Programarea inițială a fost deja modificată. Reîncarcă pagina.' }, { status: 409 })
    if (isBookingConflict(error)) return NextResponse.json({ error: 'Intervalul tocmai a fost ocupat. Alege altă oră.' }, { status: 409 })
    throw error
  }
}
