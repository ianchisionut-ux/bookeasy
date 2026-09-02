import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signCalendarState } from '@/lib/google-calendar-oauth'

export async function GET(req: NextRequest) {
  const session = await auth()
  const requestedBusinessId = req.nextUrl.searchParams.get('businessId') ?? undefined
  const initiatedBySuperAdmin = Boolean((session as any)?.isSuperAdmin && requestedBusinessId)
  const businessId = initiatedBySuperAdmin ? requestedBusinessId : ((session as any)?.businessId as string | undefined)
  const practitionerId = req.nextUrl.searchParams.get('practitionerId')
  const backPath = initiatedBySuperAdmin && businessId ? `/superadmin/afaceri/${businessId}` : '/dashboard/medici'
  if (!businessId || !practitionerId) return NextResponse.redirect(new URL(`${backPath}?google=unauthorized`, req.url))
  const practitioner = await prisma.practitioner.findFirst({ where: { id: practitionerId, businessId } })
  if (!practitioner) return NextResponse.redirect(new URL(`${backPath}?google=not_found`, req.url))
  const redirectUri = `${process.env.APP_URL}/api/google-calendar/callback`
  const state = signCalendarState({ businessId, practitionerId, initiatedBySuperAdmin, expiresAt: Date.now() + 10 * 60_000 })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: 'openid email https://www.googleapis.com/auth/calendar', state }).toString()
  return NextResponse.redirect(url)
}
