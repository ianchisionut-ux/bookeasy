import { prisma } from './prisma'
import { extractBookingIntent } from './nlu'
import { getAvailableSlots } from './availability'

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
}: {
  businessId: string
  currentState: ConversationState
  incomingText: string
  conversationUpdatedAt: Date
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
      // NOTE: creează efectiv rezervarea aici — vezi createBooking() de mai jos, apelat cu phone/externalUserId real
      return { reply: 'Rezervarea a fost confirmată! Îți trimitem un reminder înainte de programare.', newState: { step: 'IDLE' } }
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ro-RO', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}
