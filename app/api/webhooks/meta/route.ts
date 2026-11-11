import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processIncomingMessage } from '@/lib/bot-engine'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  const validToken = Boolean(token) && (
    token === process.env.META_VERIFY_TOKEN || token === process.env.INSTAGRAM_VERIFY_TOKEN
  )
  if (mode === 'subscribe' && validToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const signature = req.headers.get('x-hub-signature-256')
  const signedBy = new Set(Object.entries({ meta: process.env.META_APP_SECRET, instagram: process.env.INSTAGRAM_APP_SECRET }).filter(([, secret]) => {
    if (!secret || !signature) return false
    const expected = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex'))
    const received = Buffer.from(signature)
    return received.length === expected.length && crypto.timingSafeEqual(received, expected)
  }).map(([provider]) => provider))
  if (!signedBy.size) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  for (const entry of body.entry ?? []) {
    if (body.object === 'instagram') {
      await handleMessengerEntry(entry, 'INSTAGRAM', signedBy)
    } else if (body.object === 'page' && signedBy.has('meta')) {
      await handleMessengerEntry(entry, 'FACEBOOK', signedBy)
    }
  }

  return NextResponse.json({ received: true })
}

async function handleMessengerEntry(entry: any, type: 'INSTAGRAM' | 'FACEBOOK', signedBy: Set<string>) {
  for (const messaging of entry.messaging ?? []) await handleMessengerMessage(entry, messaging, type, signedBy)
}

async function handleMessengerMessage(entry: any, messaging: any, type: 'INSTAGRAM' | 'FACEBOOK', signedBy: Set<string>) {
  // Mesajele expediate de operator/pagină revin ca ecouri prin webhook.
  if (messaging?.message?.is_echo) return
  // apăsarea pe un buton de carousel vine ca "postback", nu ca "message" — trebuie
  // tratate separat, altfel butoanele din carousel sunt complet ignorate
  const effectiveText = messaging?.postback?.payload ?? messaging?.message?.quick_reply?.payload ?? messaging?.message?.text
  if (!messaging || (!messaging.message && !messaging.postback)) return

  const messageId = messaging.message?.mid ?? messaging.postback?.mid
  const pageId = entry.id
  const channel = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId: pageId } } })
  if (!channel || channel.status === 'DISCONNECTED' || !signedBy.has(type === 'INSTAGRAM' && channel.authProvider === 'instagram' ? 'instagram' : 'meta')) return

  await processWebhookOnce(messageId, async () => {
  await processIncomingMessage({
    businessId: channel.businessId,
    channel: type,
    externalUserId: messaging.sender.id,
    text: effectiveText ?? '[atașament]',
    channelId: channel.id,
  })
  })
}

async function processWebhookOnce(messageId: string | undefined, process: () => Promise<void>) {
  if (!messageId) { await process(); return }
  const claimToken = crypto.randomUUID()
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + 5 * 60_000)
  try {
    await prisma.processedWebhookMessage.create({ data: { id: messageId, status: 'PROCESSING', claimToken, leaseUntil } })
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error
    const claimed = await prisma.processedWebhookMessage.updateMany({
      where: { id: messageId, status: 'PROCESSING', leaseUntil: { lt: now } },
      data: { claimToken, leaseUntil },
    })
    if (!claimed.count) {
      const existing = await prisma.processedWebhookMessage.findUnique({ where: { id: messageId } })
      if (existing?.status === 'DONE') return
      throw new Error('Webhook processing is still in progress; retry required')
    }
  }
  try {
    await process()
    await prisma.processedWebhookMessage.updateMany({
      where: { id: messageId, claimToken, status: 'PROCESSING' },
      data: { status: 'DONE', processedAt: new Date(), leaseUntil: null, claimToken: null },
    })
  } catch (error) {
    await prisma.processedWebhookMessage.deleteMany({ where: { id: messageId, claimToken, status: 'PROCESSING' } })
    throw error
  }
}
