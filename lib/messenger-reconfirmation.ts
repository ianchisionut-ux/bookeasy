import { prisma } from '@/lib/prisma'
import { sendMessengerButtons } from '@/lib/channel-senders'

export async function sendMessengerReconfirmation(booking: any, platform: 'FACEBOOK' | 'INSTAGRAM' = 'FACEBOOK'): Promise<{ success: boolean; channel?: 'FACEBOOK' | 'INSTAGRAM'; error?: string }> {
  const label = platform === 'INSTAGRAM' ? 'Instagram' : 'Messenger'
  if (platform === 'INSTAGRAM' && booking.channel !== 'INSTAGRAM') return { success: false, error: 'Programarea nu provine de pe Instagram.' }
  const recipient = platform === 'INSTAGRAM' ? booking.customer?.instagramUserId : booking.customer?.facebookUserId
  if (!recipient) return { success: false, error: `Clientul nu are un profil ${label} asociat. Folosește separat reconfirmarea SMS.` }
  const channel = await prisma.channel.findFirst({ where: { businessId: booking.businessId, type: platform, status: { in: ['ACTIVE', 'EXPIRING_SOON'] } }, select: { id: true } })
  if (!channel) return { success: false, error: `Conectează ${label} în Setări pentru această afacere.` }
  const date = booking.startAt.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: booking.business.timezone || 'Europe/Bucharest' })
  const bodyText = `Reconfirmare programare\n${booking.service.name}\n${date}\n${booking.business.name}`
  const suffix = `${booking.id}.${booking.confirmationRequestToken}`
  try {
    await sendMessengerButtons({ channelId: channel.id, to: recipient, bodyText, options: [{ id: `REMINDER_CONFIRM_${suffix}`, title: 'Confirmă programarea' }, { id: `REMINDER_RESCHEDULE_${suffix}`, title: 'Reprogramează' }, { id: `REMINDER_CANCEL_${suffix}`, title: 'Anulează programarea' }] })
    await prisma.chatMessage.create({ data: { businessId: booking.businessId, channel: platform, externalUserId: recipient, direction: 'OUT', text: bodyText } }).catch(() => null)
    return { success: true, channel: platform }
  } catch { return { success: false, error: `${label} nu a permis trimiterea reconfirmării. Verifică integrarea și dacă poți răspunde în conversația clientului.` } }
}
