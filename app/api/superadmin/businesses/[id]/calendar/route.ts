import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/crypto'
import { integrationRequest } from '@/lib/manual-integrations'

const schema = z.object({
  practitionerId: z.string().optional(),
  displayName: z.string().trim().email().max(254),
  externalId: z.string().trim().min(1).max(500),
  accessToken: z.string().trim().max(20000).optional(),
  refreshToken: z.string().trim().max(20000).optional(),
  expiresInMinutes: z.number().int().min(1).max(525600),
  syncEnabled: z.boolean(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'invalid origin' }, { status: 403 })
  const { id: businessId } = await params
  const business = await prisma.business.findFirst({ where: { id: businessId, accountActive: true }, select: { name: true, teamSize: true } })
  if (!business) return NextResponse.json({ error: 'Afacerea nu există sau este inactivă.' }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Verifică emailul Google, calendarul și valabilitatea tokenului.' }, { status: 400 })
  const input = parsed.data
  let practitioner = input.practitionerId ? await prisma.practitioner.findFirst({ where: { id: input.practitionerId, businessId, active: true } }) : business.teamSize <= 1 ? await prisma.practitioner.findFirst({ where: { businessId, active: true }, orderBy: { createdAt: 'asc' } }) : null
  if ((input.practitionerId || business.teamSize > 1) && !practitioner) return NextResponse.json({ error: 'Profilul nu aparține acestei afaceri.' }, { status: 404 })
  try {
    const existing = practitioner ? await prisma.googleCalendarConnection.findUnique({ where: { practitionerId: practitioner.id } }) : null
    const sameAccount = existing?.googleEmail?.toLowerCase() === input.displayName.toLowerCase()
    const token = input.accessToken || (sameAccount && existing ? decrypt(existing.accessToken) : '')
    if (!token) throw new Error('Access token este obligatoriu pentru un cont Google nou.')
    const profile = await integrationRequest('https://openidconnect.googleapis.com/v1/userinfo', token)
    if (profile.email_verified !== true || String(profile.email).toLowerCase() !== input.displayName.toLowerCase()) throw new Error('Tokenul nu corespunde utilizatorului Google introdus. Sunt necesare permisiunile openid și email.')
    const calendar = await integrationRequest(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.externalId)}`, token)
    if (!calendar.id) throw new Error('Calendarul nu este accesibil cu tokenul introdus.')
    // Changing credentials must never carry over another account's refresh token.
    const refreshToken = input.refreshToken ? encrypt(input.refreshToken) : sameAccount ? existing?.refreshToken : null
    if (!refreshToken) throw new Error('Refresh token este obligatoriu pentru sincronizare de durată.')
    const expiresAt = input.accessToken ? new Date(Date.now() + input.expiresInMinutes * 60000) : existing?.expiresAt ?? new Date(Date.now() + input.expiresInMinutes * 60000)
    if (!practitioner) practitioner = await prisma.practitioner.create({ data: { businessId, name: business.name } })
    const practitionerId = practitioner.id
    await prisma.$transaction(async tx => {
      const credentials = { googleEmail: input.displayName, calendarId: String(calendar.id), calendarName: String(calendar.summary || business.name), accessToken: encrypt(token), refreshToken, expiresAt, syncEnabled: input.syncEnabled, lastError: null }
      await tx.googleCalendarConnection.upsert({ where: { practitionerId }, create: { businessId, practitionerId, ...credentials }, update: credentials })
      if (existing && existing.calendarId !== calendar.id) await tx.booking.updateMany({ where: { businessId, ...(business.teamSize > 1 ? { practitionerId } : {}) }, data: { googleCalendarEventId: null, googleCalendarSyncedAt: null, googleCalendarSyncError: null } })
    })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Configurarea manuală nu a putut fi verificată.' }, { status: 400 })
  }
}
