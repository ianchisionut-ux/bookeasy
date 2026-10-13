import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Parola trebuie să aibă cel puțin 8 caractere.').max(72, 'Parola este prea lungă.').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Parola este prea lungă.'),
})

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Reîncarcă pagina și încearcă din nou.' }, { status: 403 })
  }
  if (!rateLimit(`customer-register:${getClientIp(req)}`, 5, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'Prea multe încercări. Revino în câteva minute.' }, { status: 429 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Date invalide.' }, { status: 400 })
  }
  try {
    await prisma.user.create({
      data: { email: parsed.data.email, password: await bcrypt.hash(parsed.data.password, 12), role: 'CUSTOMER', businessId: null },
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Există deja un cont cu acest email. Autentifică-te sau resetează parola.' }, { status: 409 })
    }
    console.error('Customer registration failed')
    return NextResponse.json({ error: 'Contul nu a putut fi creat. Încearcă din nou.' }, { status: 503 })
  }
}
