import { prisma } from '@/lib/prisma'
import { failure, fitnessActor, input, json } from '@/lib/fitness-auth'
import { messageInput } from '@/lib/fitness-validation'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: Request) {
  try {
    const { client } = await fitnessActor(req)
    const before = new URL(req.url).searchParams.get('before')
    if (before && !Number.isFinite(Date.parse(before))) return json({ error: 'Cursor invalid.' }, 400)
    const messages = await prisma.fitnessMessage.findMany({
      where: { clientId: client.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100,
    })
    return json({ messages: messages.reverse(), hasMore: messages.length === 100 })
  } catch (e) { return failure(e) }
}
export async function POST(req: Request) {
  try {
    const { client, owner } = await fitnessActor(req)
    const message = await input(req, messageInput)
    if (!rateLimit(`fitness-message:${client.id}:${owner}`, 30, 60_000).allowed) return json({ error: 'Prea multe mesaje. Încearcă peste un minut.' }, 429)
    return json(await prisma.fitnessMessage.create({ data: { clientId: client.id, sender: owner ? 'INSTRUCTOR' : 'CLIENT', text: message.text } }), 201)
  } catch (e) { return failure(e) }
}
