import { sendWhatsAppButtons, sendMessengerButtons } from './channel-senders'

export async function sendConfirmationRequest(booking: any): Promise<boolean> {
  const channel = booking.business.channels.find(
    (c: any) => c.type === booking.channel && c.status === 'ACTIVE' && c.enabledByOwner
  )
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
    if (booking.channel === 'WHATSAPP') {
      await sendWhatsAppButtons({ channelId: channel.id, to: booking.customer.phone, bodyText, options })
    } else {
      await sendMessengerButtons({ channelId: channel.id, to: booking.customer.phone, bodyText, options })
    }
    return true
  } catch {
    return false
  }
}
