import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendUnconfirmedBookingAlert } from '@/lib/email'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // WhatsApp nu mai trimite reminder-e automate. Cron-ul păstrează numai alerta
  // internă prin email pentru cererile de reconfirmare trimise manual de administrator.
  const results = { unconfirmedAlerts: 0 }
  await sendUnconfirmedAlerts(new Date(), results)
  return NextResponse.json(results)
}

async function sendUnconfirmedAlerts(now: Date, results: { unconfirmedAlerts: number }) {
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      confirmationRequestSent: true,
      customerConfirmed: null,
      unconfirmedAlertSent: false,
      startAt: { gte: now, lte: windowEnd },
    },
    include: { customer: true, service: true, business: { include: { users: { where: { role: 'OWNER' } } } } },
  })

  for (const booking of bookings) {
    const ownerEmail = booking.business.users[0]?.email
    if (!ownerEmail) continue
    await sendUnconfirmedBookingAlert({
      to: ownerEmail,
      businessName: booking.business.name,
      customerName: booking.customer.name ?? booking.customer.phone ?? 'Fără nume',
      customerPhone: booking.customer.phone ?? 'Nespecificat',
      serviceName: booking.service.name,
      startAt: booking.startAt,
    }).catch((error) => console.error('Eroare la alerta de neconfirmare:', error))
    await prisma.booking.update({ where: { id: booking.id }, data: { unconfirmedAlertSent: true } })
    results.unconfirmedAlerts++
  }
}
