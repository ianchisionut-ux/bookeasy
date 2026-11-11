import { NextRequest, NextResponse } from 'next/server'
import { importReceivedEmail, verifyResendWebhook } from '@/lib/platform-email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook neconfigurat.' }, { status: 503 })
  }
  const payload = await req.text()
  if (!verifyResendWebhook(payload, req.headers)) {
    return NextResponse.json({ error: 'Semnătură invalidă.' }, { status: 400 })
  }
  let event: { type?: string; data?: { email_id?: string; id?: string } }
  try { event = JSON.parse(payload) } catch { return NextResponse.json({ error: 'JSON invalid.' }, { status: 400 }) }
  if (event.type !== 'email.received') return NextResponse.json({ ok: true })
  const emailId = event.data?.email_id || event.data?.id
  if (!emailId) return NextResponse.json({ error: 'ID email lipsă.' }, { status: 400 })
  try {
    await importReceivedEmail(emailId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[resend] Import email eșuat:', emailId, error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Import eșuat temporar.' }, { status: 500 })
  }
}
