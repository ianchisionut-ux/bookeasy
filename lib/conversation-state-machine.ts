import { prisma } from './prisma'
import { getAvailableSlots, isSlotStillAvailable, getPractitionerDaySlotsWithStatus, isPractitionerSlotStillAvailable } from './availability'
import { getNextSequenceNumber } from './booking-number'

// fluxul botului folosește opțiuni interactive tappable (listă pe WhatsApp, carousel pe
// Messenger/Instagram) — clientul apasă direct pe alegere. Rămâne și un fallback pe
// text simplu (scrie numărul din listă), pentru robustețe.
export type ChoiceOption = { id: string; title: string; subtitle?: string }
export type ChoiceGroup = { label: string; options: ChoiceOption[] }

export type BotReply =
  | { kind: 'text'; text: string }
  | { kind: 'choices'; text: string; header: string; buttonLabel: string; groups: ChoiceGroup[] }

export type ConversationState = {
  step:
    | 'IDLE'
    | 'SELECTING_SERVICE'
    | 'SELECTING_PRACTITIONER'
    | 'SELECTING_DAY'
    | 'SELECTING_TIME'
    | 'COLLECTING_NAME'
    | 'CONFIRMING'
  serviceId?: string
  serviceOptions?: ChoiceOption[]
  practitionerId?: string
  practitionerOptions?: ChoiceOption[]
  selectedDay?: string // ISO al zilei alese (00:00)
  dayOptions?: ChoiceOption[]
  startAt?: string
  timeOptions?: ChoiceOption[]
  customerName?: string
}

const CANCEL_PATTERNS = /^(nu|stop|anuleaz[ăa]|renun[țt]|las[ăa]|gata)\b/i
const RESTART_PATTERNS = /^(reia|de la [îi]nceput|resetez[ăa]?|programare|nou[ăa])\b/i
const WELCOME_OPTIONS: ChoiceOption[] = [
  { id: 'START_PROGRAMARE', title: 'Fă o programare' },
  { id: 'OPERATOR', title: 'Vorbește cu un operator' },
  { id: 'LINK_REZERVARE', title: 'Vezi pagina de rezervare' },
]

// potrivește răspunsul clientului cu o opțiune — fie direct după ID (a apăsat pe o
// opțiune interactivă, tap-ul trimite înapoi exact ID-ul), fie ca fallback după numărul
// poziției din listă (a scris manual "2")
function matchChoice(text: string, options: ChoiceOption[]): string | null {
  const trimmed = text.trim()
  const direct = options.find((o) => o.id === trimmed)
  if (direct) return direct.id

  const n = parseInt(trimmed, 10)
  if (!Number.isNaN(n) && n >= 1 && n <= options.length) return options[n - 1].id
  return null
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
}): Promise<{ reply: BotReply; newState: ConversationState }> {
  const hoursSinceLastMessage = (Date.now() - conversationUpdatedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceLastMessage > 24 && currentState.step !== 'IDLE') {
    currentState = { step: 'IDLE' }
  }

  if (currentState.step !== 'IDLE' && CANCEL_PATTERNS.test(incomingText.trim())) {
    return {
      reply: { kind: 'text', text: 'Am anulat. Scrie-mi "programare" oricând vrei să faci o rezervare nouă.' },
      newState: { step: 'IDLE' },
    }
  }

  if (RESTART_PATTERNS.test(incomingText.trim())) {
    currentState = { step: 'IDLE' }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { services: { where: { active: true, type: 'APPOINTMENT' } } },
  })
  if (!business) return { reply: { kind: 'text', text: 'A apărut o eroare, te rugăm încearcă mai târziu.' }, newState: { step: 'IDLE' } }

  const isMultiPractitioner = business.teamSize > 1

  switch (currentState.step) {
    case 'IDLE': {
      return showWelcome(business.name)
    }

    default:
      break
  }

  switch (currentState.step) {
    case 'SELECTING_SERVICE': {
      // dacă încă n-am arătat lista reală de servicii, suntem la meniul de start —
      // potrivim răspunsul (tap sau număr scris) cu cele 3 opțiuni inițiale
      if (!currentState.serviceOptions) {
        const welcomeChoice = matchChoice(incomingText, WELCOME_OPTIONS)

        if (welcomeChoice === 'OPERATOR') {
          await notifyOwnerOperatorRequest(businessId, channel, externalUserId)
          return {
            reply: { kind: 'text', text: 'Te punem în legătură cu un coleg — te contactăm în cel mai scurt timp posibil!' },
            newState: { step: 'IDLE' },
          }
        }
        if (welcomeChoice === 'LINK_REZERVARE') {
          return {
            reply: { kind: 'text', text: `Poți vedea toate detaliile și rezerva direct aici: ${process.env.APP_URL}/${business.slug}/rezerva` },
            newState: { step: 'IDLE' },
          }
        }
        if (welcomeChoice === 'START_PROGRAMARE') {
          return showServiceMenu(business.services)
        }

        return showWelcome(business.name)
      }

      const options = currentState.serviceOptions
      const choice = matchChoice(incomingText, options)
      if (!choice) return showWelcome(business.name)

      if (isMultiPractitioner) {
        return proceedToPractitionerSelection(businessId, { ...currentState, serviceId: choice })
      }
      return proceedToDaySelection(businessId, { ...currentState, serviceId: choice }, null)
    }

    case 'SELECTING_PRACTITIONER': {
      const options = currentState.practitionerOptions ?? []
      const choice = matchChoice(incomingText, options)
      if (!choice) {
        return { reply: { kind: 'text', text: 'Te rog alege un specialist din lista de mai sus.' }, newState: currentState }
      }
      return proceedToDaySelection(businessId, { ...currentState, practitionerId: choice }, choice)
    }

    case 'SELECTING_DAY': {
      const options = currentState.dayOptions ?? []
      const choice = matchChoice(incomingText, options)
      if (!choice) {
        return { reply: { kind: 'text', text: 'Te rog alege o zi din lista de mai sus.' }, newState: currentState }
      }
      return proceedToTimeSelection(businessId, { ...currentState, selectedDay: choice }, currentState.practitionerId ?? null)
    }

    case 'SELECTING_TIME': {
      const options = currentState.timeOptions ?? []
      const choice = matchChoice(incomingText, options)
      if (!choice) {
        return { reply: { kind: 'text', text: 'Te rog alege o oră din lista de mai sus.' }, newState: currentState }
      }

      // verificăm din nou disponibilitatea chiar înainte de a cere numele — un alt
      // client ar fi putut ocupa slotul între timp. Dacă s-a ocupat, reafișăm direct
      // orele actualizate pentru aceeași zi, fără mesaj de eroare care întrerupe fluxul
      const stillFree = currentState.practitionerId
        ? await isPractitionerSlotStillAvailable(businessId, currentState.serviceId!, currentState.practitionerId, new Date(choice))
        : await isSlotStillAvailable(businessId, currentState.serviceId!, new Date(choice))

      if (!stillFree) {
        return proceedToTimeSelection(businessId, currentState, currentState.practitionerId ?? null, true)
      }

      return {
        reply: { kind: 'text', text: 'Perfect! Cum te numești, ca să confirm rezervarea?' },
        newState: { ...currentState, step: 'COLLECTING_NAME', startAt: choice },
      }
    }

    case 'COLLECTING_NAME': {
      const name = incomingText.trim()
      if (name.length < 2) {
        return { reply: { kind: 'text', text: 'Te rog scrie-mi numele tău complet.' }, newState: currentState }
      }
      const service = business.services.find((s: any) => s.id === currentState.serviceId)
      const practitioner = currentState.practitionerId
        ? currentState.practitionerOptions?.find((p) => p.id === currentState.practitionerId)
        : null
      return {
        reply: {
          kind: 'text',
          text: `Confirm: ${service?.name}${practitioner ? ` cu ${practitioner.title}` : ''}, ${formatDate(currentState.startAt!)}, pe numele ${name}. Răspunde DA pentru confirmare.`,
        },
        newState: { ...currentState, step: 'CONFIRMING', customerName: name },
      }
    }

    case 'CONFIRMING': {
      if (!/^da\b/i.test(incomingText.trim())) {
        return {
          reply: { kind: 'text', text: 'Ok, spune-mi dacă vrei să modificăm ceva, sau scrie "programare" ca s-o luăm de la capăt.' },
          newState: currentState,
        }
      }

      const result = await createBooking({
        businessId,
        serviceId: currentState.serviceId!,
        practitionerId: currentState.practitionerId ?? null,
        startAt: currentState.startAt!,
        customerName: currentState.customerName!,
        channel,
        externalUserId,
      })

      if (!result.success) {
        return proceedToTimeSelection(businessId, currentState, currentState.practitionerId ?? null, true)
      }

      return {
        reply: { kind: 'text', text: 'Rezervarea a fost confirmată! Îți trimitem un reminder înainte de programare.' },
        newState: { step: 'IDLE' },
      }
    }

    default:
      return showWelcome(business.name)
  }
}

// primul mesaj — salut + 3 opțiuni: fă o programare, vorbește cu un operator, sau
// linkul direct către pagina publică de rezervare
function showWelcome(businessName: string) {
  return {
    reply: {
      kind: 'choices' as const,
      text: `Salut! Bine ai venit la ${businessName}. Cu ce te putem ajuta?`,
      header: businessName,
      buttonLabel: 'Alege o opțiune',
      groups: [{ label: 'Opțiuni', options: WELCOME_OPTIONS }],
    },
    newState: { step: 'SELECTING_SERVICE' as const },
  }
}

function showServiceMenu(services: { id: string; name: string; durationMin: number | null; price: any }[]) {
  if (services.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Momentan nu avem servicii disponibile online — te rugăm sună-ne direct.' },
      newState: { step: 'IDLE' as const },
    }
  }

  const options: ChoiceOption[] = services.map((s) => ({
    id: s.id,
    title: s.name,
    subtitle: [s.durationMin ? `${s.durationMin} min` : null, s.price ? `${s.price} lei` : null].filter(Boolean).join(' · ') || undefined,
  }))

  return {
    reply: {
      kind: 'choices' as const,
      text: 'Ce serviciu te interesează?',
      header: 'Servicii',
      buttonLabel: 'Alege serviciul',
      groups: [{ label: 'Servicii', options }],
    },
    newState: { step: 'SELECTING_SERVICE' as const, serviceOptions: options },
  }
}

async function proceedToPractitionerSelection(businessId: string, state: ConversationState) {
  const associations = await prisma.servicePractitioner.findMany({
    where: { serviceId: state.serviceId! },
    include: { practitioner: true },
  })
  const eligible = associations.length > 0
    ? associations.map((a) => a.practitioner).filter((p) => p.active)
    : await prisma.practitioner.findMany({ where: { businessId, active: true } })

  if (eligible.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Momentan nu avem niciun specialist disponibil pentru acest serviciu. Te rugăm sună-ne direct.' },
      newState: { step: 'IDLE' as const },
    }
  }

  if (eligible.length === 1) {
    // un singur specialist eligibil — nu mai întrebăm, trecem direct la alegerea zilei
    return proceedToDaySelection(businessId, { ...state, practitionerId: eligible[0].id }, eligible[0].id)
  }

  const options: ChoiceOption[] = eligible.map((p) => ({ id: p.id, title: p.name, subtitle: p.specialization ?? undefined }))
  return {
    reply: {
      kind: 'choices' as const,
      text: 'La ce specialist dorești programarea?',
      header: 'Specialiști',
      buttonLabel: 'Alege specialistul',
      groups: [{ label: 'Specialiști', options }],
    },
    newState: { ...state, step: 'SELECTING_PRACTITIONER' as const, practitionerOptions: options },
  }
}

// zilele afișate sunt STRICT cele cu cel puțin o oră liberă — nu apar deloc zile fără
// nimic disponibil, ca să nu ducă clientul într-o fundătură
async function proceedToDaySelection(businessId: string, state: ConversationState, practitionerId: string | null) {
  const dayOptions: ChoiceOption[] = []

  for (let i = 0; i < 14 && dayOptions.length < 10; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + i)

    const slots = practitionerId
      ? (await getPractitionerDaySlotsWithStatus(businessId, state.serviceId!, practitionerId, d)).filter((s) => s.available)
      : await getAvailableSlots(businessId, state.serviceId!, d)

    if (slots.length === 0) continue

    const label = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' })
    dayOptions.push({ id: d.toISOString(), title: capitalize(label), subtitle: `${slots.length} ore disponibile` })
  }

  if (dayOptions.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Ne pare rău, nu avem zile disponibile în perioada următoare. Te rugăm sună-ne direct.' },
      newState: { step: 'IDLE' as const },
    }
  }

  return {
    reply: {
      kind: 'choices' as const,
      text: 'Alege ziua care ți se potrivește:',
      header: 'Zile disponibile',
      buttonLabel: 'Alege ziua',
      groups: [{ label: 'Zile', options: dayOptions }],
    },
    newState: { ...state, step: 'SELECTING_DAY' as const, dayOptions },
  }
}

// orele afișate sunt STRICT cele libere, chiar acum — niciodată o oră deja ocupată sau
// blocată de administrator. Recalculate mereu la moment, ca să nu apară niciodată
// mesajul de "s-a ocupat între timp"
async function proceedToTimeSelection(
  businessId: string,
  state: ConversationState,
  practitionerId: string | null,
  wasJustTaken = false
) {
  const day = new Date(state.selectedDay!)

  const allSlots = practitionerId
    ? await getPractitionerDaySlotsWithStatus(businessId, state.serviceId!, practitionerId, day)
    : (await getAvailableSlots(businessId, state.serviceId!, day)).map((s) => ({ time: s, available: true }))

  const available = allSlots.filter((s) => s.available)

  if (available.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Ne pare rău, nu mai sunt ore libere în această zi. Scrie "programare" ca să alegi altă zi.' },
      newState: { step: 'IDLE' as const },
    }
  }

  const timeOptions: ChoiceOption[] = available.slice(0, 10).map((s) => ({ id: s.time, title: formatTime(s.time) }))

  return {
    reply: {
      kind: 'choices' as const,
      text: wasJustTaken
        ? 'Ne pare rău, ora aleasă tocmai a fost ocupată — iată orele actualizate, încă disponibile:'
        : 'Alege ora care ți se potrivește:',
      header: 'Ore disponibile',
      buttonLabel: 'Alege ora',
      groups: [{ label: 'Ore', options: timeOptions }],
    },
    newState: { ...state, step: 'SELECTING_TIME' as const, timeOptions },
  }
}

async function notifyOwnerOperatorRequest(businessId: string, channel: string, externalUserId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { users: { where: { role: 'OWNER' } } },
  })
  const owner = business?.users[0]
  if (!owner) return

  const { sendAlertEmail } = await import('./email')
  await sendAlertEmail({
    to: owner.email,
    subject: `Un client cere să vorbească cu un operator (${channel})`,
    businessName: business!.name,
    channelType: channel,
    isExpired: false,
    daysLeft: 0,
    reconnectUrl: `${process.env.APP_URL}/dashboard/canale`,
  }).catch(() => {})
}

async function createBooking({
  businessId,
  serviceId,
  practitionerId,
  startAt,
  customerName,
  channel,
  externalUserId,
}: {
  businessId: string
  serviceId: string
  practitionerId: string | null
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
  const stillFree = practitionerId
    ? await isPractitionerSlotStillAvailable(businessId, serviceId, practitionerId, startDate)
    : await isSlotStillAvailable(businessId, serviceId, startDate)
  if (!stillFree) return { success: false }

  // identificăm clientul diferit în funcție de canal — doar pe WhatsApp externalUserId
  // e efectiv numărul de telefon; pe Instagram/Facebook e un ID intern al platformei
  const phoneField = { phone: externalUserId }
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
      practitionerId: practitionerId ?? null,
      startAt: startDate,
      endAt: endDate,
      status: 'CONFIRMED',
      channel,
      sequenceNumber,
    },
  })

  return { success: true }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
}
