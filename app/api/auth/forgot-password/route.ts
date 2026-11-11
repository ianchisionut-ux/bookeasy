import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordToken, sendPasswordResetEmail, withEmailTimeout } from '@/lib/password-tokens'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), accountType: z.enum(['customer', 'business']).default('business') })

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const ipCheck = await rateLimit(`forgot-pw-ip:${ip}`, 5, 15 * 60 * 1000) // 5/15min/IP
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: 'Prea multe încercări. Așteaptă câteva minute.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Email invalid.' }, { status: 400 })

  // limitare și pe email — ca cineva să nu poată bombarda inbox-ul unei singure victime
  const emailCheck = await rateLimit(`forgot-pw-email:${parsed.data.email.toLowerCase()}`, 3, 60 * 60 * 1000) // 3/oră/email
  if (!emailCheck.allowed) {
    return NextResponse.json({ success: true }) // răspuns normal, nu confirmăm limita — nu vrem să dezvăluim nimic
  }

  const user = await prisma.user.findUnique({ where: { email_accountKind: { email: parsed.data.email, accountKind: parsed.data.accountType === 'customer' ? 'CUSTOMER' : 'BUSINESS' } } })

  // răspundem la fel indiferent dacă emailul există sau nu — nu confirmăm/infirmăm
  // existența unui cont, ca să nu putem fi folosiți pentru a "ghici" clienți înregistrați
  if (user) {
    const token = await createPasswordToken(user.id)
    await withEmailTimeout(sendPasswordResetEmail(user.email, token, parsed.data.accountType))
  }

  return NextResponse.json({ success: true })
}
