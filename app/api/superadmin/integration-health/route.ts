import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const request = (url: string, init: RequestInit = {}) => fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const [calendars, channels] = await Promise.all([
    prisma.googleCalendarConnection.findMany({ where: { businessId } }),
    prisma.channel.findMany({ where: { businessId, type: { in: ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP'] } } }),
  ])
  const google = []
  for (const connection of calendars) {
    try {
      let token = decrypt(connection.accessToken)
      if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now() + 60000) {
        if (!connection.refreshToken) { google.push({ status: 'reconnect_required' }); continue }
        const refresh = await request('https://oauth2.googleapis.com/token', {
          method: 'POST', body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            refresh_token: decrypt(connection.refreshToken), grant_type: 'refresh_token',
          }),
        })
        const data = await refresh.json() as { access_token?: string; error?: string }
        if (!refresh.ok || !data.access_token) { google.push({ status: 'refresh_failed', http: refresh.status, code: data.error }); continue }
        token = data.access_token
      }
      const result = await request(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}`, { headers: { Authorization: `Bearer ${token}` } })
      google.push({ status: result.ok ? 'calendar_access_ok' : 'calendar_access_failed', http: result.status, syncEnabled: connection.syncEnabled })
      await result.body?.cancel()
    } catch { google.push({ status: 'connection_or_decryption_failed' }) }
  }
  const meta = []
  for (const channel of channels) {
    try {
      const result = await request(`https://graph.facebook.com/v21.0/${encodeURIComponent(channel.externalId)}?fields=id`, { headers: { Authorization: `Bearer ${decrypt(channel.accessToken)}` } })
      const data = await result.json() as { error?: { code?: number; error_subcode?: number } }
      meta.push({ type: channel.type, status: result.ok ? 'access_ok' : 'access_failed', http: result.status, code: data.error?.code, subcode: data.error?.error_subcode })
    } catch { meta.push({ type: channel.type, status: 'connection_or_decryption_failed' }) }
  }
  let email: Record<string, unknown> = { status: 'not_configured' }
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await request('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })
      const data = await result.json() as { data?: { name: string; status: string }[] }
      email = { status: result.ok ? 'account_access_ok' : 'not_verified', http: result.status, senderDomainStatus: data.data?.find(d => d.name === 'bookeasy.ro')?.status, notificationRecipientConfigured: Boolean(process.env.ADMIN_NOTIFICATION_EMAIL) }
    } catch { email = { status: 'connection_failed' } }
  }
  return NextResponse.json({ google, meta, email, scope: 'Provider access only; no appointments, messages or emails sent.' }, { headers: { 'Cache-Control': 'no-store' } })
}
