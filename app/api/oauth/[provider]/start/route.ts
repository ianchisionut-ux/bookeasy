import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signOAuthState } from '@/lib/oauth-state'
import { instagramLoginConfigured, INSTAGRAM_SCOPE } from '@/lib/instagram-login'

const OAUTH_CONFIG = {
  instagram: {
    authUrl: 'https://www.instagram.com/oauth/authorize',
    clientId: process.env.INSTAGRAM_APP_ID!,
    scope: INSTAGRAM_SCOPE,
    extraParams: { enable_fb_login: 'false', force_reauth: 'true' },
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    scope: 'https://www.googleapis.com/auth/business.manage',
    extraParams: { access_type: 'offline', prompt: 'consent' },
  },
  meta: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    clientId: process.env.META_APP_ID!,
    scope: 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging',
    extraParams: { auth_type: 'rerequest' },
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
  if (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER') return NextResponse.json({ error: 'Doar proprietarul poate conecta conturile afacerii.' }, { status: 403 })
  if (provider === 'meta' && req.nextUrl.searchParams.get('channel') === 'instagram') {
    const url = new URL('/api/oauth/instagram/start', req.url)
    url.search = req.nextUrl.search
    return NextResponse.redirect(url)
  }

  // super adminul poate conecta un canal în numele oricărui business (?businessId=xxx);
  // altfel, folosim business-ul propriu din sesiune
  const targetBusinessId = req.nextUrl.searchParams.get('businessId')
  const isSuperAdmin = (session as any).isSuperAdmin
  const businessId = isSuperAdmin && targetBusinessId ? targetBusinessId : (session as any).businessId
  if (!businessId || !(await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Afacerea nu există.' }, { status: 404 })
  }

  const config = OAUTH_CONFIG[provider]
  const metaChannel = provider === 'meta' && req.nextUrl.searchParams.get('channel') === 'instagram' ? 'instagram' : 'messenger'
  if (provider === 'instagram' && !instagramLoginConfigured()) {
    const redirectTo = isSuperAdmin && targetBusinessId ? `/superadmin/afaceri/${businessId}` : '/dashboard/setari'
    return NextResponse.redirect(new URL(`${redirectTo}?error=${encodeURIComponent('Conectarea Instagram este în curs de configurare. Contactează echipa BookEasy.')}`, req.url))
  }
  const redirectUri = `${process.env.APP_URL}/api/oauth/${provider}/callback`

  const redirectTo = isSuperAdmin && targetBusinessId
    ? `/superadmin/afaceri/${businessId}`
    : req.nextUrl.searchParams.get('source') === 'settings'
      ? '/dashboard/setari'
      : '/dashboard/canale'

  const nonce = crypto.randomUUID()
  const state = signOAuthState({ provider, userId: (session as any).userId, businessId, redirectTo, ...(provider === 'meta' ? { metaChannel } : {}), nonce, issuedAt: Date.now() })

  const url = new URL(config.authUrl)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', provider === 'meta' && metaChannel === 'instagram'
    ? 'pages_show_list,pages_manage_metadata,pages_read_engagement,instagram_basic,instagram_manage_messages'
    : config.scope)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  Object.entries(config.extraParams).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const response = NextResponse.redirect(url.toString())
  response.cookies.set(`bookeasy_oauth_${provider}`, nonce, { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: `/api/oauth/${provider}`, maxAge: 600 })
  return response
}
