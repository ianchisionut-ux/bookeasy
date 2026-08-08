import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMessage } from '@/lib/channel-senders'
import { sendUnconfirmedBookingAlert } from '@/lib/email'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { sent24h: 0, sent1h: 0, unconfirmedAlerts: 0, failed: 0 }

  await send24hReminders(now, results)
  await send1hReminders(now, results)
  await sendUnconfirmedAlerts(now, results)

  return NextResponse.json(results)
}

// timpul de trimitere e configurabil per business (Setări → Reminder) — aducem un
// interval larg (până la 48h, cel mai mare timp posibil de ales) și filtrăm exact în
// funcție de reminderMinutesBefore al fiecărei afaceri în parte
async function send24hReminders(now: Date, results: { sent24h: number; failed: number }) {
  const maxWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', reminder24hSent: false, startAt: { gte: now, lte: maxWindowEnd } },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })

  for (const booking of bookings) {
    const targetMinutes = booking.business.reminderMinutesBefore ?? 1440
    const minutesUntil = (booking.startAt.getTime() - now.getTime()) / 60000
    // toleranță de ±7.5 min (jumătate din intervalul de 15 min al cron-ului), ca fiecare
    // programare să primească reminder o singură dată, exact aproape de timpul ales
    if (Math.abs(minutesUntil - targetMinutes) > 7.5) continue

    const ok = await sendReminder(booking, 'main')
    if (ok) {
      // reminder-ul principal e și cererea de confirmare activă — marcăm ambele
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminder24hSent: true, confirmationRequestSent: true },
      })
      results.sent24h++
    } else {
      results.failed++
    }
  }
}

async function send1hReminders(now: Date, results: { sent1h: number; failed: number }) {
  const windowStart = new Date(now.getTime() + 0.75 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 1.25 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', reminder1hSent: false, startAt: { gte: windowStart, lte: windowEnd } },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })

  for (const booking of bookings) {
    const ok = await sendReminder(booking, '1h')
    if (ok) {
      await prisma.booking.update({ where: { id: booking.id }, data: { reminder1hSent: true } })
      results.sent1h++
    } else {
      results.failed++
    }
  }
}

// dacă am cerut confirmare (la reminder-ul de 24h) și clientul tot n-a răspuns, iar
// programarea e la mai puțin de 3 ore — anunțăm proprietarul, o dată, ca să poată suna
// direct clientul dacă vrea să se asigure că vine
async function sendUnconfirmedAlerts(now: Date, results: { unconfirmedAlerts: number }) {
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
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
      customerName: booking.customer.name ?? booking.customer.phone,
      customerPhone: booking.customer.phone,
      serviceName: booking.service.name,
      startAt: booking.startAt,
    }).catch((err) => console.error('Eroare la alerta de neconfirmare:', err))

    await prisma.booking.update({ where: { id: booking.id }, data: { unconfirmedAlertSent: true } })
    results.unconfirmedAlerts++
  }
}

async function sendReminder(booking: any, type: 'main' | '1h') {
  const channel = booking.business.channels.find(
    (c: any) => c.type === booking.channel && c.status === 'ACTIVE' && c.enabledByOwner
  )
  if (!channel) return false

  const text =
    type === 'main'
      ? `Ai o programare la ${booking.business.name} pentru ${booking.service.name}, pe ${formatDateTime(booking.startAt)}. Confirmi? Răspunde DA pentru confirmare, sau ANULEZ dacă nu mai poți veni.`
      : `Programarea ta pentru ${booking.service.name} e peste o oră (${formatTime(booking.startAt)}). Te așteptăm!`

  try {
    await sendMessage({ channel: booking.channel, channelId: channel.id, to: booking.customer.phone, text })
    return true
  } catch {
    return false
  }
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
}
