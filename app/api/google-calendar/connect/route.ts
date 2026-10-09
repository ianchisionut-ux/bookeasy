import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signCalendarState } from '@/lib/google-calendar-oauth'

export async function GET(req: NextRequest) {
  const session = await auth()
  const requestedBusinessId = req.nextUrl.searchParams.get('businessId') ?? undefined
  const initiatedBySuperAdmin = Boolean((session as any)?.isSuperAdmin && requestedBusinessId)
  const businessId = initiatedBySuperAdmin ? requestedBusinessId : ((session as any)?.businessId as string | undefined)
  const requestedPractitionerId = req.nextUrl.searchParams.get('practitionerId')
  const returnTo = req.nextUrl.searchParams.get('source') === 'settings' ? 'settings' : 'practitioners'
  const backPath = initiatedBySuperAdmin && businessId ? `/superadmin/afaceri/${businessId}` : returnTo === 'settings' ? '/dashboard/setari' : '/dashboard/medici'
  if (!businessId) return NextResponse.redirect(new URL(`${backPath}?google=unauthorized`, req.url))

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, teamSize: true } })
  if (!business) return NextResponse.redirect(new URL(`${backPath}?google=not_found`, req.url))

  // Afacerile individuale nu au nevoie de o fișă vizibilă în Medici/Echipă.
  // Păstrăm intern un profil implicit deoarece legătura Google Calendar este
  // modelată pe practitioner, dar utilizatorul configurează calendarul afacerii.
  let practitioner = requestedPractitionerId
    ? await prisma.practitioner.findFirst({ where: { id: requestedPractitionerId, businessId } })
    : null
  if (!practitioner && !requestedPractitionerId && business.teamSize <= 1) {
    practitioner = await prisma.practitioner.findFirst({
      where: { businessId },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    })
    if (!practitioner) {
      practitioner = await prisma.practitioner.create({ data: { businessId, name: business.name } })
    }
  }
  if (!practitioner) return NextResponse.redirect(new URL(`${backPath}?google=not_found`, req.url))
  const redirectUri = `${process.env.APP_URL}/api/google-calendar/callback`
  const state = signCalendarState({ businessId, practitionerId: practitioner.id, initiatedBySuperAdmin, returnTo, expiresAt: Date.now() + 10 * 60_000 })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  // BookEasy creează un calendar secundar propriu și gestionează exclusiv evenimentele
  // din el. Nu avem nevoie de acces la toate calendarele utilizatorului.
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'openid email https://www.googleapis.com/auth/calendar.app.created',
    state,
  }).toString()
  return NextResponse.redirect(url)
}
