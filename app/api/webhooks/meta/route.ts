import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processIncomingMessage } from '@/lib/bot-engine'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-hub-signature-256')
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(rawBody).digest('hex')

  if (signature !== expected) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)

  for (const entry of body.entry ?? []) {
    if (body.object === 'whatsapp_business_account') {
      await handleWhatsAppEntry(entry)
    } else if (body.object === 'instagram') {
      await handleMessengerEntry(entry, 'INSTAGRAM')
    } else if (body.object === 'page') {
      await handleMessengerEntry(entry, 'FACEBOOK')
    }
  }

  return NextResponse.json({ received: true })
}

async function handleWhatsAppEntry(entry: any) {
  const value = entry.changes?.[0]?.value
  const message = value?.messages?.[0]
  if (!message) return

  const phoneNumberId = value.metadata.phone_number_id
  const channel = await prisma.channel.findUnique({
    where: { type_externalId: { type: 'WHATSAPP', externalId: phoneNumberId } },
  })
  if (!channel) return

  await processIncomingMessage({
    businessId: channel.businessId,
    channel: 'WHATSAPP',
    externalUserId: message.from,
    text: message.text?.body ?? extractNonTextContent(message),
    channelId: channel.id,
  })
}

async function handleMessengerEntry(entry: any, type: 'INSTAGRAM' | 'FACEBOOK') {
  const messaging = entry.messaging?.[0]
  if (!messaging?.message) return

  const pageId = entry.id
  const channel = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId: pageId } } })
  if (!channel) return

  await processIncomingMessage({
    businessId: channel.businessId,
    channel: type,
    externalUserId: messaging.sender.id,
    text: messaging.message.text ?? '[atașament]',
    channelId: channel.id,
  })
}

function extractNonTextContent(message: any) {
  if (message.type === 'audio') return '[mesaj audio]'
  if (message.type === 'image') return '[imagine]'
  return '[conținut nesuportat]'
}
