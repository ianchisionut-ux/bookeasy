import { prisma } from './prisma'
import { decrypt } from './crypto'

type Channel = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'

export async function sendMessage({
  channel,
  channelId,
  to,
  text,
}: {
  channel: Channel
  channelId: string
  to: string
  text: string
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  if (channel === 'WHATSAPP') {
    await fetch(`https://graph.facebook.com/v21.0/${channelRecord.externalId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    })
    return
  }

  // Instagram și Facebook Messenger folosesc același Send API
  await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: to }, message: { text } }),
  })
}

// butoane verticale, stivuite — max 3, folosite pentru meniuri scurte (start, confirmare)
// unde clientul trebuie să vadă toate opțiunile deodată, nu într-un carousel cu swipe
export async function sendWhatsAppButtons({
  channelId,
  to,
  bodyText,
  options,
}: {
  channelId: string
  to: string
  bodyText: string
  options: { id: string; title: string }[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  await fetch(`https://graph.facebook.com/v21.0/${channelRecord.externalId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText.slice(0, 1024) },
        action: {
          buttons: options.slice(0, 3).map((o) => ({
            type: 'reply',
            reply: { id: o.id.slice(0, 256), title: o.title.slice(0, 20) },
          })),
        },
      },
    }),
  })
}

export async function sendMessengerButtons({
  channelId,
  to,
  bodyText,
  options,
}: {
  channelId: string
  to: string
  bodyText: string
  options: { id: string; title: string }[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: to },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: bodyText.slice(0, 640),
            buttons: options.slice(0, 3).map((o) => ({ type: 'postback', title: o.title.slice(0, 20), payload: o.id })),
          },
        },
      },
    }),
  })
}

export type ChoiceGroup = {
  label: string // ex: numele zilei — apare ca titlu de secțiune (WhatsApp) sau se include în titlul cardului (Messenger)
  options: { id: string; title: string; subtitle?: string }[] // id = valoarea reală trimisă înapoi la selectare (ex: ISO al orei)
}

// listă interactivă, tappable — clientul apasă direct, nu mai scrie un număr. WhatsApp
// limitează la 10 rânduri TOTAL (nu per secțiune), deci grupurile trebuie deja limitate
// înainte să ajungă aici
export async function sendWhatsAppList({
  channelId,
  to,
  headerText,
  bodyText,
  buttonText,
  groups,
}: {
  channelId: string
  to: string
  headerText: string
  bodyText: string
  buttonText: string
  groups: ChoiceGroup[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  const sections = groups.map((g) => ({
    title: g.label.slice(0, 24),
    rows: g.options.map((o) => ({
      id: o.id.slice(0, 200),
      title: o.title.slice(0, 24),
      ...(o.subtitle ? { description: o.subtitle.slice(0, 72) } : {}),
    })),
  }))

  await fetch(`https://graph.facebook.com/v21.0/${channelRecord.externalId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText.slice(0, 60) },
        body: { text: bodyText.slice(0, 1024) },
        action: { button: buttonText.slice(0, 20), sections },
      },
    }),
  })
}

// carousel real, cu carduri orizontale — folosit pe Messenger/Instagram. Limită Meta:
// 10 carduri per mesaj. Fiecare card e o opțiune selectabilă printr-un buton
export async function sendMessengerCarousel({
  channelId,
  to,
  cards,
}: {
  channelId: string
  to: string
  cards: { id: string; title: string; subtitle?: string; buttonLabel: string }[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  const elements = cards.slice(0, 10).map((c) => ({
    title: c.title.slice(0, 80),
    ...(c.subtitle ? { subtitle: c.subtitle.slice(0, 80) } : {}),
    buttons: [{ type: 'postback', title: c.buttonLabel.slice(0, 20), payload: c.id }],
  }))

  await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: to },
      message: { attachment: { type: 'template', payload: { template_type: 'generic', elements } } },
    }),
  })
}
