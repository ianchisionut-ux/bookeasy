import { googleBusinessCredentials } from '@/lib/google-business-oauth'
import { businessOAuthOrigin } from '@/lib/business-oauth-origin'
import { facebookLoginConfiguration } from '@/lib/meta-facebook-login'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signOAuthState } from '@/lib/oauth-state'
import { businessHasPlan } from '@/lib/business-plan-access'

const OAUTH_CONFIG = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: '',
    scope: 'https://www.googleapis.com/auth/business.manage',
    extraParams: { access_type: 'offline', prompt: 'consent' },
  },
  meta: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    clientId: process.env.META_APP_ID!,
    scope: 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging',
    extraParams: { auth_type: 'rerequest' },
  },
  instagram: {
    authUrl: 'https://www.instagram.com/oauth/authorize',
    clientId: process.env.INSTAGRAM_APP_ID!,
    scope: 'instagram_business_basic,instagram_business_manage_messages',
    extraParams: { force_reauth: 'true' },
  },
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params
  if (providerRaw !== 'google' && providerRaw !== 'meta' && providerRaw !== 'instagram') {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
  }
  const provider = providerRaw as 'google' | 'meta' | 'instagram'

  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  if (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (providerRaw === 'instagram') {
    const target = new URL(req.url)
    target.pathname = '/api/oauth/meta/start'
    target.searchParams.set('channel', 'both')
    return NextResponse.redirect(target)
  }
  const origin = businessOAuthOrigin(req)

  // super adminul poate conecta un canal în numele oricărui business (?businessId=xxx);
  // altfel, folosim business-ul propriu din sesiune
  const targetBusinessId = req.nextUrl.searchParams.get('businessId')
  const isSuperAdmin = (session as any).isSuperAdmin
  const businessId = isSuperAdmin && targetBusinessId ? targetBusinessId : (session as any).businessId
  if (!businessId || !(await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Afacerea nu există.' }, { status: 404 })
  }
  if (!(await businessHasPlan(businessId, 'STANDARD', isSuperAdmin))) {
    return NextResponse.redirect(new URL('/dashboard/planuri', req.url))
  }

  const businessCredentials = provider === 'google' ? googleBusinessCredentials() : null
  if (provider === 'google' && !businessCredentials) return NextResponse.redirect(new URL('/dashboard/setari?error=' + encodeURIComponent('Conectarea Google Business Profile nu este configurată complet. Contactează echipa BookEasy.'), req.url))
  const config = provider === 'google' ? { ...OAUTH_CONFIG.google, clientId: businessCredentials!.clientId } : OAUTH_CONFIG[provider]
  const choice = req.nextUrl.searchParams.get('channel')
  const metaChannel = choice === 'messenger' || choice === 'instagram' ? choice : 'both'
  const instagramEnabled = process.env.META_INSTAGRAM_OAUTH_ENABLED === 'true'
  if (provider === 'instagram' && (!instagramEnabled || !process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET)) {
    const redirectTo = isSuperAdmin && targetBusinessId ? `/superadmin/afaceri/${businessId}` : '/dashboard/setari'
    return NextResponse.redirect(new URL(`${redirectTo}?error=${encodeURIComponent('Conectarea Instagram necesită configurarea aplicației Instagram în Vercel.')}`, req.url))
  }
  const redirectUri = `${origin}/api/oauth/${provider}/callback`

  const redirectTo = isSuperAdmin && targetBusinessId
    ? `/superadmin/afaceri/${businessId}`
    : req.nextUrl.searchParams.get('source') === 'settings'
      ? '/dashboard/setari'
      : '/dashboard/setari'

  const facebookConfigId = provider === 'meta' ? facebookLoginConfiguration() : null
  if (provider === 'meta' && !facebookConfigId) {
    return NextResponse.redirect(new URL(`${redirectTo}?error=${encodeURIComponent('Conectarea Facebook și Instagram nu este configurată complet. Contactează echipa BookEasy.')}`, req.url))
  }

  const nonce = crypto.randomUUID()
  const state = signOAuthState({ provider, businessId, redirectTo, ...(provider === 'meta' ? { metaChannel } : {}), userId: (session as any).userId, origin, nonce, issuedAt: Date.now() })

  const url = new URL(config.authUrl)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  const scope = provider === 'meta' && metaChannel !== 'messenger' ? `${config.scope},instagram_basic,instagram_manage_messages` : config.scope
  // Business Login reads permissions and token type from its configuration.
  // A plain scope URL does not select the dedicated user-token configuration.
  if (facebookConfigId) url.searchParams.set('config_id', facebookConfigId)
  else url.searchParams.set('scope', scope)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  Object.entries(config.extraParams).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const response = NextResponse.redirect(url.toString())
  response.cookies.set(`bookeasy_oauth_${provider}`, nonce, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https:'), path: `/api/oauth/${provider}`, maxAge: 600 })
  return response
}

