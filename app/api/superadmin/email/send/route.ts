import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { sendPlatformEmail } from '@/lib/platform-email'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const check = rateLimit(`platform-email:${(session as any).userId}`, 30, 60 * 60 * 1000)
  if (!check.allowed) return NextResponse.json({ error: 'Prea multe mesaje trimise.' }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const to = String(body.to || '').slice(0, 320)
  const subject = String(body.subject || '').slice(0, 300)
  const message = String(body.message || '').slice(0, 50000)
  try {
    const email = await sendPlatformEmail({ to, subject, message })
    return NextResponse.json({ email }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Trimiterea a eșuat.' }, { status: 400 })
  }
}
