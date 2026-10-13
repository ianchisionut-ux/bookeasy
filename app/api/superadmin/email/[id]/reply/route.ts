import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sendPlatformEmail } from '@/lib/platform-email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const check = rateLimit(`platform-email:${(session as any).userId}`, 30, 60 * 60 * 1000)
  if (!check.allowed) return NextResponse.json({ error: 'Prea multe mesaje trimise.' }, { status: 429 })
  const { id } = await params
  const original = await prisma.platformEmail.findUnique({ where: { id } })
  if (!original || original.direction !== 'inbound') return NextResponse.json({ error: 'Mesajul nu există.' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const message = String(body.message || '').slice(0, 50000)
  const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`
  try {
    const email = await sendPlatformEmail({
      to: original.replyTo || original.fromAddress, subject, message,
      replyToMessageId: original.providerMessageId,
    })
    return NextResponse.json({ email }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Răspunsul a eșuat.' }, { status: 400 })
  }
}
