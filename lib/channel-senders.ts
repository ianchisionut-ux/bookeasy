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
