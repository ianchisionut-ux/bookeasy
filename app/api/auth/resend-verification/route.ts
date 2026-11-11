import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email-verification'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  if (!(await rateLimit(`resend-verification-ip:${getClientIp(req)}`, 5, 15 * 60_000)).allowed) return NextResponse.json({ error: 'Prea multe cereri. Revino în câteva minute.' }, { status: 429 })
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Introdu o adresă de email validă.' }, { status: 400 })
  if (!(await rateLimit(`resend-verification-email:${parsed.data.email}`, 1, 60_000)).allowed) return NextResponse.json({ error: 'Așteaptă un minut înainte de a cere un email nou.' }, { status: 429 })
  const user = await prisma.user.findUnique({ where: { email_accountKind: { email: parsed.data.email, accountKind: 'BUSINESS' } } })
  if (user?.emailVerificationRequired && !user.emailVerifiedAt) {
    try { await sendVerificationEmail(user.id, user.email) } catch { return NextResponse.json({ error: 'Emailul nu a putut fi trimis. Încearcă din nou în câteva minute.' }, { status: 503 }) }
  }
  return NextResponse.json({ success: true, message: 'Dacă ai un cont care așteaptă confirmarea, ți-am trimis un email. Verifică și folderul Spam.' })
}
