import { googleBusinessCredentials, GoogleBusinessConnectionError } from '@/lib/google-business-oauth'
import { listGoogleLocations } from '@/lib/google-business-locations'
import { businessOAuthOrigin } from '@/lib/business-oauth-origin'
import { connectDirectInstagram, connectViaFacebook, MetaConnectionError } from '@/lib/business-meta'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { auth } from '@/lib/auth'
import { verifyOAuthState } from '@/lib/oauth-state'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params
  if (providerRaw !== 'google' && providerRaw !== 'meta' && providerRaw !== 'instagram') {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
  }
  const provider = providerRaw as 'google' | 'meta' | 'instagram'
  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  if (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const origin = businessOAuthOrigin(req)

  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')
  const state = stateRaw ? verifyOAuthState(stateRaw, provider) : null
  if (!state || state.origin !== origin || state.userId !== (session as any).userId || req.cookies.get(`bookeasy_oauth_${provider}`)?.value !== state.nonce) return NextResponse.redirect(origin + '/dashboard/setari?error=' + encodeURIComponent('Sesiunea de conectare a expirat sau aparține altei ferestre. Reia conectarea din Setări.'))
  if (!code) {
    const message = req.nextUrl.searchParams.get('error_description') ?? 'Autorizarea a fost anulată.'
    return NextResponse.redirect(origin + state.redirectTo + '?error=' + encodeURIComponent(message))
  }
  const { businessId, redirectTo } = state
  if (!(session as any).isSuperAdmin && (session as any).businessId !== businessId) {
    return NextResponse.redirect(origin + '/dashboard/setari?error=forbidden_business')
  }
  const redirectUri = `${origin}/api/oauth/${provider}/callback`

  if (provider === 'instagram' || provider === 'meta') {
    try {
      if (provider === 'instagram') {
        if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) throw new MetaConnectionError('configuration', 'Conectarea directă Instagram este în curs de configurare. Poți folosi alternativa prin Facebook.')
        await connectDirectInstagram(businessId, code, redirectUri)
      } else {
        const pending = await connectViaFacebook(businessId, code, redirectUri, state.metaChannel ?? 'messenger', { userId: (session as any).userId, redirectTo })
        if (pending) {
          const path = (session as any).isSuperAdmin ? '/superadmin/meta-page' : '/dashboard/meta-page'
          const response = NextResponse.redirect(new URL(`${path}?connection=${encodeURIComponent(pending.connectionId)}`, req.url))
          response.cookies.set('bookeasy_oauth_meta', '', { path: '/api/oauth/meta', maxAge: 0 })
          return response
        }
      }
      const connected = provider === 'instagram' ? 'instagram' : state.metaChannel === 'both' ? 'meta' : state.metaChannel === 'instagram' ? 'instagram' : 'messenger'
      const response = NextResponse.redirect(`${origin}${redirectTo}?connected=${connected}`)
      response.cookies.set(`bookeasy_oauth_${provider}`, '', { path: `/api/oauth/${provider}`, maxAge: 0 })
      return response
    } catch (error) {
      const known = error instanceof MetaConnectionError
      console.error('[business-meta-connect]', { provider, stage: known ? error.stage : 'save_connection', status: known ? error.status : undefined, code: known ? error.code : undefined, reason: known ? error.reason : undefined })
      const message = known ? error.message : 'Conexiunea nu a putut fi salvată. Reia conectarea sau contactează echipa BookEasy.'
      return NextResponse.redirect(`${origin}${redirectTo}?error=${encodeURIComponent(message)}`)
    }
  }

  try {
  const credentials = googleBusinessCredentials()
  if (!credentials) throw new GoogleBusinessConnectionError('configuration', 'Conectarea Google Business Profile nu este configurată complet. Contactează echipa BookEasy.')
  const tokenRes = await fetch('https://oauth2.googleapis.com/token',
    {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    }
  )
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new GoogleBusinessConnectionError('token', 'Google a refuzat autorizarea. Reia conectarea din Setări; dacă eroarea persistă, contactează echipa BookEasy.', tokenRes.status, 'token_rejected')
  }

  if (provider === 'google') {
    if (!tokenData.refresh_token) throw new GoogleBusinessConnectionError('offline_access', 'Google nu a oferit acces offline. Reia conectarea și acordă accesul solicitat.')
    const locations = await listGoogleLocations(tokenData.access_token)
    if (!locations.length) throw new GoogleBusinessConnectionError('locations', 'Contul Google nu are nicio locație Business Profile disponibilă. Alege contul care administrează afacerea.')
    const pending = await prisma.pendingGoogleConnection.create({ data: {
      businessId, userId: (session as any).userId, redirectTo,
      locations, accessToken: encrypt(tokenData.access_token), refreshToken: encrypt(tokenData.refresh_token),
      tokenExpiresAt: new Date(Date.now() + Number(tokenData.expires_in ?? 3600) * 1000),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    } })
    const selectionPath = (session as any).isSuperAdmin ? '/superadmin/google-location' : '/dashboard/google-location'
    const response = NextResponse.redirect(new URL(selectionPath + '?connection=' + pending.id, req.url))
    response.cookies.set('bookeasy_oauth_google', '', { path: '/api/oauth/google', maxAge: 0 })
    return response
  }

  const connected = provider
  return NextResponse.redirect(`${origin}${redirectTo ?? '/dashboard/canale'}?connected=${connected}`)
  } catch (error) {
    const known = error instanceof GoogleBusinessConnectionError
    console.error('[business-google-connect]', { stage: known ? error.stage : 'save_connection', status: known ? error.status : undefined, reason: known ? error.reason : undefined })
    const message = known ? error.message : 'Conectarea Google nu a putut fi salvată. Reia conectarea sau contactează echipa BookEasy.'
    return NextResponse.redirect(`${origin}${redirectTo}?error=${encodeURIComponent(message)}`)
  }
}
