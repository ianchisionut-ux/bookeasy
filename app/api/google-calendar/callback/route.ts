import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { createBookEasyCalendar, syncFutureBookings } from '@/lib/google-calendar'
import { verifyCalendarState } from '@/lib/google-calendar-oauth'

export async function GET(req: NextRequest) {
  let backPath = '/dashboard/medici'
  const back = (status: string) => NextResponse.redirect(`${process.env.APP_URL}${backPath}?google=${status}`)
  try {
    const session = await auth()
    const state = verifyCalendarState(req.nextUrl.searchParams.get('state') ?? '')
    if (state.initiatedBySuperAdmin) backPath = `/superadmin/afaceri/${state.businessId}`
    else if (state.returnTo === 'settings') backPath = '/dashboard/setari'
    const ownsBusiness = (session as any)?.businessId === state.businessId
    const isSuperAdmin = Boolean((session as any)?.isSuperAdmin)
    if ((!ownsBusiness && !(state.initiatedBySuperAdmin && isSuperAdmin)) || state.userId !== (session as any)?.userId || req.cookies.get('bookeasy_calendar_oauth')?.value !== state.nonce || (!isSuperAdmin && (session as any)?.role !== 'OWNER')) return back('unauthorized')
    const practitioner = await prisma.practitioner.findFirst({ where: { id: state.practitionerId, businessId: state.businessId }, include: { business: true } })
    if (!practitioner?.business.accountActive) return back('not_found')
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
      code: req.nextUrl.searchParams.get('code') ?? '', client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', redirect_uri: `${process.env.APP_URL}/api/google-calendar/callback`, grant_type: 'authorization_code',
    }) })
    const token = await response.json()
    if (!response.ok || !token.access_token) throw new Error(token.error_description ?? 'Google nu a returnat accesul.')
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } })
    const profile = await profileResponse.json()
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) throw new Error('Identitatea Google nu a putut fi verificată.')
    const existing = await prisma.googleCalendarConnection.findUnique({ where: { practitionerId: practitioner.id } })
    const calendarLabel = practitioner.business.teamSize > 1 ? practitioner.business.name + ' – ' + practitioner.name : practitioner.business.name
    const sameAccount = !!existing && existing.googleEmail?.toLowerCase() === profile.email.toLowerCase()
    if (!token.refresh_token && !sameAccount) throw new Error('Google nu a oferit acces offline. Reia conectarea și acordă accesul solicitat.')
    const calendar = sameAccount ? { id: existing!.calendarId, name: existing!.calendarName } : await createBookEasyCalendar(token.access_token, calendarLabel, practitioner.business.timezone)
    await prisma.$transaction(async (tx) => {
    await tx.googleCalendarConnection.upsert({ where: { practitionerId: practitioner.id }, create: {
      businessId: state.businessId, practitionerId: practitioner.id, googleEmail: profile.email ?? null, calendarId: calendar.id, calendarName: calendar.name,
      accessToken: encrypt(token.access_token), refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null, expiresAt: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000),
    }, update: {
      googleEmail: profile.email, calendarId: calendar.id, calendarName: calendar.name, accessToken: encrypt(token.access_token), refreshToken: token.refresh_token ? encrypt(token.refresh_token) : sameAccount ? existing!.refreshToken : null, expiresAt: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000), syncEnabled: true, lastError: null,
    } })
    if (!sameAccount) await tx.booking.updateMany({ where: { businessId: state.businessId, ...(practitioner.business.teamSize > 1 ? { practitionerId: practitioner.id } : {}) }, data: { googleCalendarEventId: null, googleCalendarSyncedAt: null, googleCalendarSyncError: null } })
    })
    await syncFutureBookings(practitioner.id)
    const result = back('connected')
    result.cookies.set('bookeasy_calendar_oauth', '', { path: '/api/google-calendar', maxAge: 0 })
    return result
  } catch (error) {
    console.error('[google-calendar/callback]', error)
    return back('error')
  }
}
