import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export type BookingIntent = {
  serviceId: string | null
  selectedSlot: string | null
}

export async function extractBookingIntent(
  text: string,
  services: { id: string; name: string }[]
): Promise<BookingIntent> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    tools: [
      {
        name: 'extract_booking_intent',
        description: 'Extrage intenția de rezervare dintr-un mesaj în limba română',
        input_schema: {
          type: 'object',
          properties: {
            serviceId: { type: ['string', 'null'] },
            selectedSlot: { type: ['string', 'null'], description: 'ISO datetime dacă a ales o oră' },
          },
          required: ['serviceId', 'selectedSlot'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'extract_booking_intent' },
    messages: [
      {
        role: 'user',
        content: `Servicii disponibile: ${services.map((s) => `${s.id}: ${s.name}`).join(', ')}\n\nMesaj client: "${text}"`,
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  return (toolUse as any)?.input ?? { serviceId: null, selectedSlot: null }
}
