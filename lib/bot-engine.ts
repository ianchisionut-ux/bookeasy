import { prisma } from './prisma'
import { runBotStep, ConversationState, BotReply, proceedToDaySelection } from './conversation-state-machine'
import { sendMessage, sendWhatsAppList, sendMessengerCarousel, sendWhatsAppButtons, sendMessengerButtons } from './channel-senders'
import { sendAlertEmail } from './email'
import { rateLimit } from './rate-limit'

const CANCEL_BOOKING_PATTERN = /^anulez\b/i
const CONFIRM_BOOKING_PATTERN = /^(da|confirm|confirma[țt])\b/i

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
  // limitare per utilizator — protejează costurile Meta (taxate per mesaj/conversație)
  // dacă cineva bombardează botul intenționat sau dintr-o eroare de integrare
  const { allowed } = rateLimit(`bot-msg:${businessId}:${externalUserId}`, 20, 10 * 60 * 1000) // 20 mesaje/10min
  if (!allowed) return

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business?.accountActive) return // cont suspendat de admin — botul nu răspunde deloc

  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })

  if (!channelRecord || channelRecord.status !== 'ACTIVE' || !channelRecord.enabledByOwner) {
    await notifyOwnerOfMissedMessage(businessId, channel)
    return
  }

  const trimmed = text.trim()

  // apăsare pe butonul din reminder-ul de reconfirmare (trimis cu o zi înainte, la
  // 16:00) — mai precis decât potrivirea pe text liber, fiindcă țintește exact
  // rezervarea respectivă, nu ghicește care e "cea mai apropiată"
  if (trimmed.startsWith('REMINDER_CONFIRM_')) {
    const bookingId = trimmed.replace('REMINDER_CONFIRM_', '')
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (booking && booking.businessId === businessId) {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', customerConfirmed: true } })
      await sendMessage({ channel, channelId, to: externalUserId, text: 'Perfect, programarea ta a fost confirmată! Te așteptăm.' })
    }
    return
  }

  if (trimmed.startsWith('REMINDER_RESCHEDULE_')) {
    const bookingId = trimmed.replace('REMINDER_RESCHEDULE_', '')
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (booking && booking.businessId === businessId) {
      // anulăm programarea veche și pornim direct de la alegerea unei zile noi, pentru
      // același serviciu (și aceeași persoană, dacă era cazul) — clientul nu mai trebuie
      // să aleagă din nou serviciul, doar ziua/ora noi
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', customerConfirmed: false } })

      const conversation = await prisma.conversation.findFirst({ where: { businessId, channel, externalUserId } })
      const baseState: ConversationState = { step: 'SELECTING_DAY', serviceId: booking.serviceId, practitionerId: booking.practitionerId ?? undefined }
      const { reply, newState } = await proceedToDaySelection(businessId, baseState, booking.practitionerId)

      if (conversation) {
        await prisma.conversation.update({ where: { id: conversation.id }, data: { state: newState as any, updatedAt: new Date() } })
      } else {
        await prisma.conversation.create({ data: { businessId, channel, externalUserId, state: newState as any } })
      }

      await sendReply({ channel, channelId, to: externalUserId, reply })
    }
    return
  }

  if (trimmed.startsWith('REMINDER_CANCEL_')) {
    const bookingId = trimmed.replace('REMINDER_CANCEL_', '')
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (booking && booking.businessId === businessId) {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', customerConfirmed: false } })
      await sendMessage({ channel, channelId, to: externalUserId, text: 'Am anulat programarea. Sper să te vedem altă dată!' })
    }
    return
  }

  if (CANCEL_BOOKING_PATTERN.test(text.trim())) {
    const reply = await handleBookingCancellation(businessId, channel, externalUserId)
    await sendMessage({ channel, channelId, to: externalUserId, text: reply })
    return
  }

  if (CONFIRM_BOOKING_PATTERN.test(text.trim())) {
    const reply = await handleBookingConfirmation(businessId, externalUserId)
    if (reply) {
      await sendMessage({ channel, channelId, to: externalUserId, text: reply })
      return
    }
    // "da" fără nicio programare în așteptare de confirmare — lăsăm mesajul să treacă
    // mai departe prin conversația normală (ar putea fi un răspuns la altceva, ex: preț)
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

  await sendReply({ channel, channelId, to: externalUserId, reply })
}

// alege automat formatul potrivit de trimitere: listă interactivă pe WhatsApp, carousel
// pe Messenger/Instagram, sau text simplu — în funcție de tipul de răspuns și canal
async function sendReply({
  channel,
  channelId,
  to,
  reply,
}: {
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  channelId: string
  to: string
  reply: BotReply
}) {
  if (reply.kind === 'none') return

  if (reply.kind === 'text') {
    await sendMessage({ channel, channelId, to, text: reply.text })
    return
  }

  if (reply.kind === 'buttons') {
    if (channel === 'WHATSAPP') {
      await sendWhatsAppButtons({ channelId, to, bodyText: reply.text, options: reply.options })
    } else {
      await sendMessengerButtons({ channelId, to, bodyText: reply.text, options: reply.options })
    }
    return
  }

  // reply.kind === 'choices'
  if (channel === 'WHATSAPP') {
    await sendWhatsAppList({
      channelId,
      to,
      headerText: reply.header,
      bodyText: reply.text,
      buttonText: reply.buttonLabel,
      groups: reply.groups,
    })
    return
  }

  // Messenger/Instagram — carousel real, cu titlul grupului (zi) inclus în titlul
  // cardului dacă sunt mai multe grupuri (ex: mai multe zile)
  const multiGroup = reply.groups.length > 1
  const cards = reply.groups.flatMap((g) =>
    g.options.map((o) => ({
      id: o.id,
      title: multiGroup ? `${g.label} — ${o.title}` : o.title,
      subtitle: o.subtitle,
      buttonLabel: reply.buttonLabel,
    }))
  )

  // carousel-ul (generic template) nu are un câmp separat de text introductiv, deci
  // trimitem întâi textul, apoi cardurile
  await sendMessage({ channel, channelId, to, text: reply.text })
  await sendMessengerCarousel({ channelId, to, cards })
}

async function handleBookingCancellation(businessId: string, channel: string, externalUserId: string) {
  const [upcomingBooking, business] = await Promise.all([
    prisma.booking.findFirst({
      where: {
        businessId,
        status: 'CONFIRMED',
        startAt: { gte: new Date() },
        customer: { phone: externalUserId },
      },
      include: { service: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { minLeadTimeMinutes: true } }),
  ])

  if (!upcomingBooking) {
    return 'Nu am găsit nicio programare activă pe numărul tău. Dacă ai nevoie de ajutor, scrie-ne aici.'
  }

  const minLeadMinutes = business?.minLeadTimeMinutes ?? 120
  const minutesUntilBooking = (upcomingBooking.startAt.getTime() - Date.now()) / (1000 * 60)
  if (minutesUntilBooking < minLeadMinutes) {
    const hours = Math.round(minLeadMinutes / 60)
    return `Programarea ta e prea aproape (sub ${hours} ${hours === 1 ? 'oră' : 'ore'}) pentru anulare automată — te rugăm să suni direct.`
  }

  await prisma.booking.update({ where: { id: upcomingBooking.id }, data: { status: 'CANCELLED', customerConfirmed: false } })
  return `Am anulat programarea pentru ${upcomingBooking.service.name}. Sper să te vedem altă dată!`
}

// caută cea mai apropiată programare a acestui client care așteaptă confirmare activă
// (i-am trimis deja mesajul de "confirmi?" și încă n-a răspuns) — dacă găsește una, o
// marchează confirmată; altfel întoarce null, ca "DA" să treacă mai departe prin
// conversația normală (ar putea fi răspuns la altă întrebare a botului)
async function handleBookingConfirmation(businessId: string, externalUserId: string): Promise<string | null> {
  const booking = await prisma.booking.findFirst({
    where: {
      businessId,
      status: 'CONFIRMED',
      confirmationRequestSent: true,
      customerConfirmed: null,
      startAt: { gte: new Date() },
      customer: { phone: externalUserId },
    },
    include: { service: true },
    orderBy: { startAt: 'asc' },
  })

  if (!booking) return null

  await prisma.booking.update({ where: { id: booking.id }, data: { customerConfirmed: true } })
  return `Perfect, programarea pentru ${booking.service.name} e confirmată! Te așteptăm.`
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
