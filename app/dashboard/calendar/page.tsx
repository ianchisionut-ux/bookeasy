import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { calculateAdaptiveSlotStep } from '@/lib/availability'
// react-big-calendar + date-fns fac calcule de dată/oră fără timezone explicit
// (folosesc timezone-ul runtime-ului). Pe Cloudflare Workers (edge, de regulă UTC)
// randarea server diferă de clientul din România -> React hydration error #418.
// CalendarClientLoader dezactivează SSR pentru acest component (ssr:false nu e
// permis direct într-un Server Component, de-aia trece printr-un wrapper 'use client').
import CalendarClient from './calendar-client-loader'
import Link from 'next/link'
import { Apple, CalendarDays, Dumbbell } from 'lucide-react'
import '@/components/fitness/fitness.css'
import { isPlatformSmsReady } from '@/lib/sms-routing'

function computeMinMax(hours: { startTime: string; endTime: string }[], fallbackMin = '08:00', fallbackMax = '20:00') {
  if (hours.length === 0) return { minTime: fallbackMin, maxTime: fallbackMax }
  return {
    minTime: hours.reduce((min, wh) => (wh.startTime < min ? wh.startTime : min), hours[0].startTime),
    maxTime: hours.reduce((max, wh) => (wh.endTime > max ? wh.endTime : max), hours[0].endTime),
  }
}

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const [business, platformSmsReady] = await Promise.all([prisma.business.findUnique({
    where: { id: businessId },
    include: {
      workingHours: true,
      services: { where: { active: true }, select: { id: true, name: true, type: true, durationMin: true } },
      resources: { select: { id: true, name: true } },
    },
  }), isPlatformSmsReady()])

  const isMultiPractitioner = business?.category !== 'FITNESS' && (business?.teamSize ?? 1) > 1
  const now = new Date()
  const initialFrom = new Date(now)
  initialFrom.setDate(initialFrom.getDate() - 45)
  const initialTo = new Date(now)
  initialTo.setDate(initialTo.getDate() + 75)

  const [bookings, blockedSlots, practitioners] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId, status: { not: 'CANCELLED' }, startAt: { gte: initialFrom, lte: initialTo } },
      include: { customer: true, service: true, practitioner: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, include: { workingHours: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.customer.name ?? b.customer.phone} — ${b.service.name}${b.practitioner ? ` (${b.practitioner.name})` : ''}`,
    start: b.startAt,
    end: b.endAt,
    status: b.status,
    channel: b.channel,
    customerId: b.customerId,
    customerName: b.customer.name ?? b.customer.phone ?? 'Fără nume',
    customerPhone: b.customer.phone ?? '',
    customerCreatedAt: b.customer.createdAt.toISOString(),
    serviceId: b.serviceId,
    serviceName: b.service.name,
    resourceId: b.resourceId,
    practitionerId: b.practitionerId,
    practitionerName: b.practitioner?.name ?? null,
    confirmationRequestSent: b.confirmationRequestSent,
    customerConfirmed: b.customerConfirmed,
    arrivedAt: b.arrivedAt?.toISOString() ?? null,
  }))

  const { minTime, maxTime } = computeMinMax(business?.workingHours ?? [])

  return (
    <>
    {business?.category === 'FITNESS' && <nav className="fitness-calendar-tabs" aria-label="Calendare Fitness"><Link href="/dashboard/calendar" aria-current="page"><CalendarDays size={15} />Ședințe</Link><Link href="/dashboard/fitness"><Dumbbell size={15} />Antrenamente</Link><Link href="/dashboard/fitness"><Apple size={15} />Nutriție</Link></nav>}
    <CalendarClient
      initialSmsAvailable={Boolean(platformSmsReady && business?.smsGatewayEnabled && business?.accountActive)}
      category={business?.category ?? 'SALON'}
      services={(business?.services ?? []).map((service) => ({ id: service.id, name: service.name }))}
      resources={business?.resources ?? []}
      events={events}
      blockedSlots={blockedSlots.map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        reason: b.reason,
      }))}
      minTime={minTime}
      maxTime={maxTime}
      businessWorkingHours={(business?.workingHours ?? []).map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime }))}
      businessBreaks={[
        ...(business?.break1Start && business.break1End ? [{ label: 'Pauză', startTime: business.break1Start, endTime: business.break1End }] : []),
        ...(business?.break2Start && business.break2End ? [{ label: 'Pauză 2', startTime: business.break2Start, endTime: business.break2End }] : []),
        ...(business?.break3Start && business.break3End ? [{ label: 'Pauză 3', startTime: business.break3Start, endTime: business.break3End }] : []),
      ]}
      slotIntervalMinutes={
        business?.category === 'EVENT_VENUE'
          ? 60
          : calculateAdaptiveSlotStep(
              business?.services.filter((service) => service.type === 'APPOINTMENT').map((service) => service.durationMin) ?? [],
              business?.slotIntervalMinutes
            )
      }
      practitioners={practitioners.map((p) => {
        const range = computeMinMax(p.workingHours, minTime, maxTime)
        return {
          id: p.id, name: p.name, minTime: range.minTime, maxTime: range.maxTime,
          workingHours: p.workingHours.map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime })),
          breaks: [
            ...(p.break1Start && p.break1End ? [{ label: 'Pauză', startTime: p.break1Start, endTime: p.break1End }] : []),
            ...(p.break2Start && p.break2End ? [{ label: 'Pauză 2', startTime: p.break2Start, endTime: p.break2End }] : []),
            ...(p.break3Start && p.break3End ? [{ label: 'Pauză 3', startTime: p.break3Start, endTime: p.break3End }] : []),
          ],
        }
      })}
    />
    </>
  )
}
