import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

const schema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: businessId } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele primite de la Meta sunt incomplete.' }, { status: 400 })
  if (!(await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Afacerea nu există.' }, { status: 404 })
  }

  const tokenResponse = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      code: parsed.data.code,
    }),
  })
  const tokenData = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenData.access_token) {
    return NextResponse.json({ error: tokenData.error?.message ?? 'Meta nu a returnat tokenul WhatsApp.' }, { status: 400 })
  }

  const { wabaId, phoneNumberId } = parsed.data
  const phonesResponse = await fetch('https://graph.facebook.com/v21.0/' + wabaId + '/phone_numbers?fields=id,display_phone_number,verified_name', {
    headers: { Authorization: 'Bearer ' + tokenData.access_token },
  })
  const phones = await phonesResponse.json()
  if (!phonesResponse.ok || !phones.data?.some((phone: { id: string }) => phone.id === phoneNumberId)) {
    return NextResponse.json({ error: phones.error?.message ?? 'Numărul WhatsApp nu aparține contului autorizat.' }, { status: 400 })
  }

  const subscribeResponse = await fetch('https://graph.facebook.com/v21.0/' + wabaId + '/subscribed_apps', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenData.access_token },
  })
  const subscription = await subscribeResponse.json()
  if (!subscribeResponse.ok || subscription.success === false) {
    return NextResponse.json({ error: subscription.error?.message ?? 'Abonarea webhook-ului WhatsApp a eșuat.' }, { status: 400 })
  }

  await prisma.channel.upsert({
    where: { type_externalId: { type: 'WHATSAPP', externalId: phoneNumberId } },
    create: { businessId, type: 'WHATSAPP', externalId: phoneNumberId, wabaId, accessToken: encrypt(tokenData.access_token) },
    update: { businessId, wabaId, accessToken: encrypt(tokenData.access_token), status: 'ACTIVE', enabledByOwner: true },
  })

  const phone = phones.data.find((item: { id: string }) => item.id === phoneNumberId)
  return NextResponse.json({ success: true, phone: phone?.display_phone_number ?? phoneNumberId })
}
