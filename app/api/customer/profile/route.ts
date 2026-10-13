import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clientIdentity } from '@/lib/client-profile'

const schema = z.object({
  firstName: z.string().trim().min(1, 'Completează prenumele.').max(80),
  lastName: z.string().trim().max(100),
  phone: z.string().trim().max(30).refine((value) => /^\d{7,15}$/.test(value.replace(/[^\d]/g, '')), 'Completează un număr de telefon valid.'),
})

export async function PATCH(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  const identity = clientIdentity(await auth())
  if (!identity) return NextResponse.json({ error: 'Autentifică-te în contul de client.' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Date invalide.' }, { status: 400 })
  const data = { ...parsed.data, email: identity.email }
  await prisma.clientProfile.upsert({ where: { ownerKey: identity.ownerKey }, create: { ownerKey: identity.ownerKey, ...data }, update: data })
  return NextResponse.json({ success: true })
}
