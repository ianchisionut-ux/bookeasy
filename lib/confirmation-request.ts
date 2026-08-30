import { sendMessengerButtons, sendWhatsAppButtons } from './channel-senders'
import { prisma } from './prisma'

type ReconfirmationChannel = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'

const CHANNEL_NAME: Record<ReconfirmationChannel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Messenger',
}

export async function sendConfirmationRequest(
  booking: any
): Promise<{ success: boolean; error?: string; channel?: ReconfirmationChannel }> {
  // O programare venită din Messenger/Instagram trebuie reconfirmată în aceeași
  // conversație. Pentru site, Google sau programări introduse manual păstrăm
  // comportamentul existent: WhatsApp, folosind numărul clientului.
  const preferredChannel: ReconfirmationChannel =
    booking.channel === 'FACEBOOK' || booking.channel === 'INSTAGRAM' ? booking.channel : 'WHATSAPP'
  const recipient =
    preferredChannel === 'FACEBOOK'
      ? booking.customer?.facebookUserId
      : preferredChannel === 'INSTAGRAM'
        ? booking.customer?.instagramUserId
        : booking.customer?.phone

  if (!recipient) {
    const missingIdentity =
      preferredChannel === 'WHATSAPP'
        ? 'un număr de telefon'
        : preferredChannel === 'FACEBOOK'
          ? 'un profil Messenger asociat'
          : 'un profil Instagram asociat'
    return { success: false, error: `Clientul nu are ${missingIdentity}.` }
  }

  const channel = booking.business.channels.find(
    (candidate: any) =>
      candidate.type === preferredChannel && candidate.status === 'ACTIVE' && candidate.enabledByOwner
  )
  if (!channel) {
    return {
      success: false,
      error: `Canalul ${CHANNEL_NAME[preferredChannel]} nu este conectat sau activ pentru această afacere.`,
    }
  }

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
    if (preferredChannel === 'WHATSAPP') {
      await sendWhatsAppButtons({ channelId: channel.id, to: recipient, bodyText, options })
    } else {
      await sendMessengerButtons({ channelId: channel.id, to: recipient, bodyText, options })
    }

    await prisma.chatMessage.create({
      data: {
        businessId: booking.businessId,
        channel: preferredChannel,
        externalUserId: recipient,
        direction: 'OUT',
        text: `${bodyText}\n\nConfirmă programarea / Anulează programarea`,
      },
    }).catch((error) => console.error('[reconfirmation] Nu am putut salva mesajul în inbox:', error))

    return { success: true, channel: preferredChannel }
  } catch (err: any) {
    // aici ajunge acum mesajul REAL de la Meta (ex: număr neverificat, token expirat) —
    // nu mai ascundem cauza sub un mesaj generic
    return { success: false, error: err?.message ?? 'Eroare necunoscută la trimitere.' }
  }
}
