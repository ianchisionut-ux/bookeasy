import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const OAUTH_CONFIG = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    scope: 'https://www.googleapis.com/auth/business.manage',
    extraParams: { access_type: 'offline', prompt: 'consent' },
  },
  meta: {
    authUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    clientId: process.env.META_APP_ID!,
    scope: 'whatsapp_business_messaging,pages_messaging,instagram_manage_messages,pages_show_list',
    extraParams: {},
  },
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: 'google' | 'meta' }> }) {
  const { provider } = await params
  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const config = OAUTH_CONFIG[provider]
  const redirectUri = `${process.env.APP_URL}/api/oauth/${provider}/callback`

  const state = Buffer.from(
    JSON.stringify({ businessId: (session as any).businessId, nonce: crypto.randomUUID() })
  ).toString('base64url')

  const url = new URL(config.authUrl)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', config.scope)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  Object.entries(config.extraParams).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  return NextResponse.redirect(url.toString())
}
