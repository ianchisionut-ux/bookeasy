import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS']),
  externalId: z.string().min(1),
  accessToken: z.string().optional(), // "lasă gol dacă nu schimbi" — obligatoriu doar la prima conectare
  wabaId: z.string().optional(),
  expiresInDays: z.number().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { type, externalId, accessToken, wabaId, expiresInDays } = parsed.data

  if (type === 'FACEBOOK') {
    return NextResponse.json(
      { error: 'Messenger se conectează numai prin fluxul oficial Autorizează Messenger.' },
      { status: 400 }
    )
  }

  if ((type === 'INSTAGRAM' || type === 'WHATSAPP') && !/^\d{5,}$/.test(externalId)) {
    return NextResponse.json({ error: 'ID-ul canalului trebuie să conțină numai cifre.' }, { status: 400 })
  }
  if (type === 'WHATSAPP' && wabaId && !/^\d{5,}$/.test(wabaId)) {
    return NextResponse.json({ error: 'WABA ID trebuie să conțină numai cifre.' }, { status: 400 })
  }

  try {
    const existing = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId } } })
    if (!existing && !accessToken) {
      return NextResponse.json({ error: 'Access Token e obligatoriu la prima conectare a canalului.' }, { status: 400 })
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined

    const channel = existing
      ? await prisma.channel.update({
          where: { id: existing.id },
          data: {
            businessId,
            ...(wabaId !== undefined ? { wabaId: wabaId || null } : {}),
            ...(accessToken ? { accessToken: encrypt(accessToken) } : {}),
            status: 'ACTIVE',
            ...(expiresAt ? { expiresAt } : {}),
          },
        })
      : await prisma.channel.create({
          data: {
            businessId,
            type,
            externalId,
            wabaId: wabaId || null,
            accessToken: encrypt(accessToken!),
            status: 'ACTIVE',
            enabledByOwner: true,
            expiresAt: expiresAt ?? null,
          },
        })

    return NextResponse.json({ success: true, channelId: channel.id })
  } catch (error) {
    console.error('Nu s-au putut salva datele canalului.', error)
    return NextResponse.json(
      { error: 'Datele canalului nu au putut fi salvate. Încearcă din nou.' },
      { status: 500 }
    )
  }
}
