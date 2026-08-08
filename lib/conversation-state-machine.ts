import { prisma } from './prisma'
import { getAvailableSlots, isSlotStillAvailable } from './availability'
import { getNextSequenceNumber } from './booking-number'

// fluxul botului e complet pe bază de opțiuni numerotate (servicii, ore disponibile) — clientul răspunde cu un
// număr (1, 2, 3...), nu cu text liber interpretat de AI. Simplu, previzibil, ieftin.
export type ConversationState = {
  step: 'IDLE' | 'SELECTING_SERVICE' | 'SELECTING_SLOT' | 'COLLECTING_NAME' | 'CONFIRMING'
  serviceId?: string
  serviceOptions?: string[] // ID-urile serviciilor, în ordinea afișată clientului
  startAt?: string
  slotOptions?: string[] // orele disponibile (ISO), în ordinea afișată clientului
  customerName?: string
}

const CANCEL_PATTERNS = /^(nu|stop|anuleaz[ăa]|renun[țt]|las[ăa]|gata)\b/i
const RESTART_PATTERNS = /^(reia|de la [îi]nceput|resetez[ăa]?|programare|nou[ăa])\b/i

function parseChoice(text: string, max: number): number | null {
  const n = parseInt(text.trim(), 10)
  if (Number.isNaN(n) || n < 1 || n > max) return null
  return n
}

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
    currentState = { step: 'IDLE' }
  }

  if (currentState.step !== 'IDLE' && CANCEL_PATTERNS.test(incomingText.trim())) {
    return { reply: 'Am anulat. Scrie-mi "programare" oricând vrei să faci o rezervare nouă.', newState: { step: 'IDLE' } }
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
      return showServiceMenu(business.name, business.services)
    }

    case 'SELECTING_SERVICE': {
      const options = currentState.serviceOptions ?? []
      const choice = parseChoice(incomingText, options.length)
      if (!choice) {
        return { reply: 'Te rog scrie doar numărul serviciului dorit, din lista de mai sus.', newState: currentState }
      }
      return proceedToSlotSelection(businessId, { ...currentState, serviceId: options[choice - 1] })
    }

    case 'SELECTING_SLOT': {
      const options = currentState.slotOptions ?? []
      const choice = parseChoice(incomingText, options.length)
      if (!choice) {
        return { reply: 'Te rog scrie doar numărul orei dorite, din lista de mai sus.', newState: currentState }
      }
      const selectedSlot = options[choice - 1]

      // verificăm din nou disponibilitatea chiar înainte de a cere numele — un alt client
      // ar fi putut ocupa slotul între timp
      const stillFree = await isSlotStillAvailable(businessId, currentState.serviceId!, new Date(selectedSlot))
      if (!stillFree) {
        return {
          reply: 'Ne pare rău, slotul tocmai a fost ocupat. Te rog alege altă oră din listă.',
          newState: currentState,
        }
      }

      return {
        reply: 'Perfect! Cum te numești, ca să confirm rezervarea?',
        newState: { ...currentState, step: 'COLLECTING_NAME', startAt: selectedSlot },
      }
    }

    case 'COLLECTING_NAME': {
      const name = incomingText.trim()
      if (name.length < 2) {
        return { reply: 'Te rog scrie-mi numele tău complet.', newState: currentState }
      }
      const service = business.services.find((s) => s.id === currentState.serviceId)
      return {
        reply: `Confirm: ${service?.name}, ${formatDate(currentState.startAt!)}, pe numele ${name}. Răspunde DA pentru confirmare.`,
        newState: { ...currentState, step: 'CONFIRMING', customerName: name },
      }
    }

    case 'CONFIRMING': {
      if (!/^da\b/i.test(incomingText.trim())) {
        return { reply: 'Ok, spune-mi dacă vrei să modificăm ceva, sau scrie "programare" ca s-o luăm de la capăt.', newState: currentState }
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
          reply: 'Ne pare rău, slotul tocmai a fost ocupat de altcineva. Scrie "programare" ca să alegi altă oră.',
          newState: { step: 'IDLE' },
        }
      }

      return {
        reply: 'Rezervarea a fost confirmată! Îți trimitem un reminder înainte de programare.',
        newState: { step: 'IDLE' },
      }
    }

    default:
      return showServiceMenu(business.name, business.services)
  }
}

function showServiceMenu(businessName: string, services: { id: string; name: string; durationMin: number | null; price: any }[]) {
  if (services.length === 0) {
    return {
      reply: `Salut! Bine ai venit la ${businessName}. Momentan nu avem servicii disponibile online — te rugăm sună-ne direct.`,
      newState: { step: 'IDLE' as const },
    }
  }
  const options = services.map((s) => s.id)
  const list = services
    .map((s, i) => `${i + 1}. ${s.name}${s.durationMin ? ` (${s.durationMin} min)` : ''}${s.price ? ` — ${s.price} lei` : ''}`)
    .join('\n')
  return {
    reply: `Salut! Bine ai venit la ${businessName}. Ce serviciu te interesează?\n\n${list}\n\nScrie numărul serviciului dorit.`,
    newState: { step: 'SELECTING_SERVICE' as const, serviceOptions: options },
  }
}

async function proceedToSlotSelection(businessId: string, state: ConversationState) {
  // adunăm ore libere din următoarele zile (nu doar prima zi cu loc), ca clientul să
  // poată alege între mai multe zile deodată, nu doar cea mai apropiată
  const byDay: { label: string; slots: string[] }[] = []
  let totalSlots = 0

  for (let i = 0; i < 10 && totalSlots < 12; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const daySlots = await getAvailableSlots(businessId, state.serviceId!, d)
    if (daySlots.length === 0) continue

    const label = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' })
    const take = daySlots.slice(0, 12 - totalSlots)
    byDay.push({ label, slots: take })
    totalSlots += take.length
  }

  if (byDay.length === 0) {
    return {
      reply: 'Ne pare rău, nu avem ore libere în perioada următoare. Te rugăm sună-ne direct.',
      newState: { step: 'IDLE' as const },
    }
  }

  const shown = byDay.flatMap((d) => d.slots)
  let counter = 0
  const list = byDay
    .map((d) => {
      const dayLines = d.slots
        .map((s) => {
          counter++
          return `${counter}. ${formatTime(s)}`
        })
        .join('\n')
      return `📅 ${capitalize(d.label)}\n${dayLines}`
    })
    .join('\n\n')
  return {
    reply: `Ore disponibile:\n\n${list}\n\nScrie numărul orei alese.`,
    newState: { ...state, step: 'SELECTING_SLOT' as const, slotOptions: shown },
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
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

  // verificare "ultima clipă" — cineva ar fi putut ocupa exact acest slot între timp
  const stillFree = await isSlotStillAvailable(businessId, serviceId, startDate)
  if (!stillFree) return { success: false }

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
