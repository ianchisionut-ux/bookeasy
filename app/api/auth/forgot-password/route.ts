import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordToken, sendPasswordResetEmail, withEmailTimeout } from '@/lib/password-tokens'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Email invalid.' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

  // răspundem la fel indiferent dacă emailul există sau nu — nu confirmăm/infirmăm
  // existența unui cont, ca să nu putem fi folosiți pentru a "ghici" clienți înregistrați
  if (user) {
    const token = await createPasswordToken(user.id)
    await withEmailTimeout(sendPasswordResetEmail(user.email, token))
  }

  return NextResponse.json({ success: true })
}
