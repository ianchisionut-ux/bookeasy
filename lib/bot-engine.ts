import { prisma } from './prisma'
import { runBotStep, ConversationState } from './conversation-state-machine'
import { sendMessage } from './channel-senders'
import { sendAlertEmail } from './email'

const CANCEL_BOOKING_PATTERN = /^anulez\b/i

export async function processIncomingMessage({
  businessId,
  channel,
  externalUserId,
  text,
  channelId,
}: {
  businessId: string
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  externalUserId: string
  text: string
  channelId: string
}) {
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business?.accountActive) return // cont suspendat de admin — botul nu răspunde deloc

  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })

  if (!channelRecord || channelRecord.status !== 'ACTIVE' || !channelRecord.enabledByOwner) {
    await notifyOwnerOfMissedMessage(businessId, channel)
    return
  }

  if (CANCEL_BOOKING_PATTERN.test(text.trim())) {
    const reply = await handleBookingCancellation(businessId, channel, externalUserId)
    await sendMessage({ channel, channelId, to: externalUserId, text: reply })
    return
  }

  let conversation = await prisma.conversation.findFirst({ where: { businessId, channel, externalUserId } })
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { businessId, channel, externalUserId, state: { step: 'IDLE' } },
    })
  }

  const { reply, newState } = await runBotStep({
    businessId,
    currentState: conversation.state as unknown as ConversationState,
    incomingText: text,
    conversationUpdatedAt: conversation.updatedAt,
    channel,
    externalUserId,
  })

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: newState as any, updatedAt: new Date() },
  })

  await sendMessage({ channel, channelId, to: externalUserId, text: reply })
}

async function handleBookingCancellation(businessId: string, channel: string, externalUserId: string) {
  const upcomingBooking = await prisma.booking.findFirst({
    where: {
      businessId,
      status: 'CONFIRMED',
      startAt: { gte: new Date() },
      customer: { phone: externalUserId },
    },
    include: { service: true },
    orderBy: { startAt: 'asc' },
  })

  if (!upcomingBooking) {
    return 'Nu am găsit nicio programare activă pe numărul tău. Dacă ai nevoie de ajutor, scrie-ne aici.'
  }

  const hoursUntilBooking = (upcomingBooking.startAt.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntilBooking < 2) {
    return 'Programarea ta e în mai puțin de 2 ore, te rugăm să suni direct pentru anulare.'
  }

  await prisma.booking.update({ where: { id: upcomingBooking.id }, data: { status: 'CANCELLED' } })
  return `Am anulat programarea pentru ${upcomingBooking.service.name}. Sper să te vedem altă dată!`
}

async function notifyOwnerOfMissedMessage(businessId: string, channel: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { users: { where: { role: 'OWNER' } } },
  })
  const owner = business?.users[0]
  if (!owner) return

  const recentAlert = await prisma.missedMessageAlert.findFirst({
    where: { businessId, channel, sentAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  })
  if (recentAlert) return

  await sendAlertEmail({
    to: owner.email,
    subject: `Un client a scris pe ${channel}, dar botul nu e conectat`,
    businessName: business!.name,
    channelType: channel,
    isExpired: true,
    daysLeft: 0,
    reconnectUrl: `${process.env.APP_URL}/dashboard/canale`,
  })

  await prisma.missedMessageAlert.create({ data: { businessId, channel, sentAt: new Date() } })
}
