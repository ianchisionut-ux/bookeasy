import { sendWhatsAppButtons } from './channel-senders'

export async function sendConfirmationRequest(booking: any): Promise<boolean> {
  // reminder-ul merge mereu pe WhatsApp, indiferent pe ce canal a fost făcută
  // programarea inițial (bot, site sau introdusă manual de admin) — dacă avem telefon,
  // avem cum să trimitem
  const channel = booking.business.channels.find((c: any) => c.type === 'WHATSAPP' && c.status === 'ACTIVE' && c.enabledByOwner)
  if (!channel) return false

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  })

  const bodyText = [
    '*Confirmă programarea*',
    '',
    `Serviciu: ${booking.service.name}`,
    `Data: ${dateTime}`,
    `Locație: ${booking.business.name}`,
  ].join('\n')

  const options = [
    { id: `REMINDER_CONFIRM_${booking.id}`, title: 'Confirmă programarea' },
    { id: `REMINDER_CANCEL_${booking.id}`, title: 'Anulează programarea' },
  ]

  try {
    await sendWhatsAppButtons({ channelId: channel.id, to: booking.customer.phone, bodyText, options })
    return true
  } catch {
    return false
  }
}
