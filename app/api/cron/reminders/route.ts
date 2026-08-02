import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMessage } from '@/lib/channel-senders'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { sent24h: 0, sent1h: 0, failed: 0 }

  await send24hReminders(now, results)
  await send1hReminders(now, results)

  return NextResponse.json(results)
}

async function send24hReminders(now: Date, results: { sent24h: number; failed: number }) {
  const windowStart = new Date(now.getTime() + 23.75 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 24.25 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', reminder24hSent: false, startAt: { gte: windowStart, lte: windowEnd } },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })

  for (const booking of bookings) {
    const ok = await sendReminder(booking, '24h')
    if (ok) {
      await prisma.booking.update({ where: { id: booking.id }, data: { reminder24hSent: true } })
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

async function sendReminder(booking: any, type: '24h' | '1h') {
  const channel = booking.business.channels.find(
    (c: any) => c.type === booking.channel && c.status === 'ACTIVE' && c.enabledByOwner
  )
  if (!channel) return false

  const text =
    type === '24h'
      ? `Reminder: mâine ai programare la ${booking.business.name} pentru ${booking.service.name}, ora ${formatTime(booking.startAt)}. Răspunde ANULEZ dacă nu mai poți veni.`
      : `Programarea ta pentru ${booking.service.name} e peste o oră (${formatTime(booking.startAt)}). Te așteptăm!`

  try {
    await sendMessage({ channel: booking.channel, channelId: channel.id, to: booking.customer.phone, text })
    return true
  } catch {
    return false
  }
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}
