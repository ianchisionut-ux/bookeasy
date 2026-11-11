import { NextRequest, NextResponse } from 'next/server'
import { confirmEmail } from '@/lib/email-verification'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  if (!(await rateLimit(`verify-email:${getClientIp(req)}`, 20, 15 * 60_000)).allowed) return NextResponse.json({ error: 'Prea multe încercări. Revino în câteva minute.' }, { status: 429 })
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success || !(await confirmEmail(parsed.data.token))) return NextResponse.json({ error: 'Linkul a expirat sau a fost deja folosit. Cere un email nou sau intră în cont dacă ai confirmat deja.' }, { status: 400 })
  return NextResponse.json({ success: true })
}
