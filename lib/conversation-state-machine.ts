import { prisma } from './prisma'
import { extractBookingIntent } from './nlu'
import { getAvailableSlots, findAvailableStaffForSlot } from './availability'
import { getNextSequenceNumber } from './booking-number'

export type ConversationState = {
  step: 'IDLE' | 'SELECTING_SERVICE' | 'SELECTING_SLOT' | 'COLLECTING_NAME' | 'CONFIRMING'
  serviceId?: string
  startAt?: string
  customerName?: string
}

const CANCEL_PATTERNS = /^(nu|stop|anuleaz[ăa]|renun[țt]|las[ăa]|gata)\b/i
const RESTART_PATTERNS = /^(reia|de la [îi]nceput|resetez[ăa]?)\b/i

export async function runBotStep({
  businessId,
  currentState,
  incomingText,
  conversationUpdatedAt,
  channel,
  externalUserId,
}: {
  businessId: string
  currentState: ConversationState
  incomingText: string
  conversationUpdatedAt: Date
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  externalUserId: string
}): Promise<{ reply: string; newState: ConversationState }> {
  const hoursSinceLastMessage = (Date.now() - conversationUpdatedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceLastMessage > 24 && currentState.step !== 'IDLE') {
    return {
      reply: 'Bine ai revenit! Programarea anterioară nu s-a finalizat, așa că o luăm de la capăt. Ce serviciu te interesează?',
      newState: { step: 'SELECTING_SERVICE' },
    }
  }

  if (currentState.step !== 'IDLE' && CANCEL_PATTERNS.test(incomingText.trim())) {
    return { reply: 'Am anulat. Dacă vrei să faci o programare, scrie-mi oricând.', newState: { step: 'IDLE' } }
  }

  if (RESTART_PATTERNS.test(incomingText.trim())) {
    currentState = { step: 'IDLE' }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { services: { where: { active: true } } },
  })
  if (!business) return { reply: 'A apărut o eroare, te rugăm încearcă mai târziu.', newState: { step: 'IDLE' } }

  switch (currentState.step) {
    case 'IDLE': {
      const intent = await extractBookingIntent(incomingText, business.services)
      if (intent.serviceId) return proceedToSlotSelection(businessId, { ...currentState, serviceId: intent.serviceId })

      return {
        reply: `Salut! Bine ai venit la ${business.name}. Ce serviciu te interesează?\n\n${business.services
          .map((s) => `• ${s.name}`)
          .join('\n')}`,
        newState: { step: 'SELECTING_SERVICE' },
      }
    }

    case 'SELECTING_SERVICE': {
      const intent = await extractBookingIntent(incomingText, business.services)
      if (!intent.serviceId) return { reply: 'Nu am recunoscut serviciul, poți alege din listă?', newState: currentState }
      return proceedToSlotSelection(businessId, { ...currentState, serviceId: intent.serviceId })
    }

    case 'SELECTING_SLOT': {
      const intent = await extractBookingIntent(incomingText, business.services)
      if (!intent.selectedSlot) {
        return { reply: 'Nu am înțeles ora aleasă, te rog scrie exact ca în listă (ex: "Marți 14:00").', newState: currentState }
      }

      // verificăm din nou disponibilitatea chiar înainte de a cere numele — un alt client
      // ar fi putut ocupa slotul între timp
      const staffId = await findAvailableStaffForSlot(businessId, currentState.serviceId!, new Date(intent.selectedSlot))
      if (!staffId) {
        return {
          reply: 'Ne pare rău, slotul tocmai a fost ocupat. Te rog alege altă oră din listă.',
          newState: currentState,
        }
      }

      return {
        reply: 'Perfect! Cum te numești, ca să confirm rezervarea?',
        newState: { ...currentState, step: 'COLLECTING_NAME', startAt: intent.selectedSlot },
      }
    }

    case 'COLLECTING_NAME': {
      const name = incomingText.trim()
      const service = business.services.find((s) => s.id === currentState.serviceId)
      return {
        reply: `Confirm: ${service?.name}, ${formatDate(currentState.startAt!)}, pe numele ${name}. Răspunde DA pentru confirmare.`,
        newState: { ...currentState, step: 'CONFIRMING', customerName: name },
      }
    }

    case 'CONFIRMING': {
      if (!/^da\b/i.test(incomingText.trim())) {
        return { reply: 'Ok, spune-mi dacă vrei să modificăm ceva.', newState: currentState }
      }

      const result = await createBooking({
        businessId,
        serviceId: currentState.serviceId!,
        startAt: currentState.startAt!,
        customerName: currentState.customerName!,
        channel,
        externalUserId,
      })

      if (!result.success) {
        return {
          reply: 'Ne pare rău, slotul tocmai a fost ocupat de altcineva. Te rog alege altă oră.',
          newState: { step: 'IDLE' },
        }
      }

      return {
        reply: 'Rezervarea a fost confirmată! Îți trimitem un reminder înainte de programare.',
        newState: { step: 'IDLE' },
      }
    }

    default:
      return { reply: 'Ne poți spune ce serviciu te interesează?', newState: { step: 'SELECTING_SERVICE' } }
  }
}

async function proceedToSlotSelection(businessId: string, state: ConversationState) {
  const slots = await getAvailableSlots(businessId, state.serviceId!, new Date())
  return {
    reply: `Sloturi disponibile:\n${slots.slice(0, 5).map((s) => `• ${formatDate(s)}`).join('\n')}`,
    newState: { ...state, step: 'SELECTING_SLOT' as const },
  }
}

async function createBooking({
  businessId,
  serviceId,
  startAt,
  customerName,
  channel,
  externalUserId,
}: {
  businessId: string
  serviceId: string
  startAt: string
  customerName: string
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  externalUserId: string
}): Promise<{ success: boolean }> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return { success: false }

  const startDate = new Date(startAt)
  const endDate = new Date(startDate.getTime() + (service.durationMin ?? 30) * 60000)

  // alocăm acum, la confirmarea finală, un angajat liber — verificare "ultima clipă"
  // pentru cazul (rar dar posibil) în care altcineva a apucat același slot între timp
  const staffId = await findAvailableStaffForSlot(businessId, serviceId, startDate)
  if (!staffId) return { success: false }

  // identificăm clientul diferit în funcție de canal — doar pe WhatsApp externalUserId
  // e efectiv numărul de telefon; pe Instagram/Facebook e un ID intern al platformei
  const phoneField = channel === 'WHATSAPP' ? { phone: externalUserId } : { phone: externalUserId }
  const channelIdField =
    channel === 'INSTAGRAM' ? { instagramUserId: externalUserId } : channel === 'FACEBOOK' ? { facebookUserId: externalUserId } : {}

  const customer = await prisma.customer.upsert({
    where:
      channel === 'WHATSAPP'
        ? { businessId_phone: { businessId, phone: externalUserId } }
        : channel === 'INSTAGRAM'
          ? { businessId_instagramUserId: { businessId, instagramUserId: externalUserId } }
          : { businessId_facebookUserId: { businessId, facebookUserId: externalUserId } },
    create: { businessId, name: customerName, ...phoneField, ...channelIdField },
    update: { name: customerName },
  })

  const sequenceNumber = await getNextSequenceNumber(businessId, startDate)

  await prisma.booking.create({
    data: {
      businessId,
      customerId: customer.id,
      serviceId,
      staffId,
      startAt: startDate,
      endAt: endDate,
      status: 'CONFIRMED',
      channel,
      sequenceNumber,
    },
  })

  return { success: true }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ro-RO', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
}
