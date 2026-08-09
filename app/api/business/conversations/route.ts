import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const conversations = await prisma.conversation.findMany({
    where: { businessId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  // aducem ultimul mesaj + numele clientului (dacă există deja ca fișă), pentru fiecare
  // conversație — separat, ca să nu complicăm interogarea principală
  const enriched = await Promise.all(
    conversations.map(async (c) => {
      const [lastMessage, customer] = await Promise.all([
        prisma.chatMessage.findFirst({
          where: { businessId, channel: c.channel, externalUserId: c.externalUserId },
          orderBy: { createdAt: 'desc' },
        }),
        c.channel === 'WHATSAPP'
          ? prisma.customer.findFirst({ where: { businessId, phone: c.externalUserId } })
          : c.channel === 'INSTAGRAM'
            ? prisma.customer.findFirst({ where: { businessId, instagramUserId: c.externalUserId } })
            : prisma.customer.findFirst({ where: { businessId, facebookUserId: c.externalUserId } }),
      ])

      return {
        id: c.id,
        channel: c.channel,
        externalUserId: c.externalUserId,
        customerName: customer?.name ?? null,
        customerId: customer?.id ?? null,
        needsOperator: c.needsOperator,
        updatedAt: c.updatedAt.toISOString(),
        lastMessage: lastMessage ? { text: lastMessage.text, direction: lastMessage.direction, createdAt: lastMessage.createdAt.toISOString() } : null,
      }
    })
  )

  // conversațiile care așteaptă un operator, primele — restul, după cea mai recentă activitate
  enriched.sort((a, b) => {
    if (a.needsOperator !== b.needsOperator) return a.needsOperator ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return NextResponse.json({ conversations: enriched })
}
