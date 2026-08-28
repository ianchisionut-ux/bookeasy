import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { auth } from '@/lib/auth'
import { verifyOAuthState } from '@/lib/oauth-state'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params
  if (providerRaw !== 'google' && providerRaw !== 'meta') {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
  }
  const provider = providerRaw as 'google' | 'meta'
  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')
  if (!code || !stateRaw) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/canale?error=missing_code`)
  }

  const state = verifyOAuthState(stateRaw, provider)
  if (!state) return NextResponse.redirect(process.env.APP_URL + '/dashboard/canale?error=invalid_state')
  const { businessId, redirectTo } = state
  if (!(session as any).isSuperAdmin && (session as any).businessId !== businessId) {
    return NextResponse.redirect(process.env.APP_URL + '/dashboard/canale?error=forbidden_business')
  }
  const redirectUri = `${process.env.APP_URL}/api/oauth/${provider}/callback`

  const tokenRes = await fetch(
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://graph.facebook.com/v21.0/oauth/access_token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: provider === 'google' ? process.env.GOOGLE_CLIENT_ID! : process.env.META_APP_ID!,
        client_secret: provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET! : process.env.META_APP_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    }
  )
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    const message = tokenData.error?.message ?? 'Meta nu a returnat tokenul de acces.'
    return NextResponse.redirect(process.env.APP_URL + redirectTo + '?error=' + encodeURIComponent(message))
  }

  if (provider === 'meta') {
    const longLived = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    ).then((r) => r.json())

    const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${longLived.access_token}`).then((r) =>
      r.json()
    )

    if (longLived.error || pages.error || !pages.data?.length) {
      const message = longLived.error?.message ?? pages.error?.message ?? 'Nu a fost selectată nicio Pagină Facebook.'
      return NextResponse.redirect(process.env.APP_URL + redirectTo + '?error=' + encodeURIComponent(message))
    }

    for (const page of pages.data ?? []) {
      const subscription = await fetch(`https://graph.facebook.com/v21.0/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads&access_token=${page.access_token}`, { method: 'POST' })
      const subscriptionData = await subscription.json()
      if (!subscription.ok || subscriptionData.error) {
        const message = subscriptionData.error?.message ?? 'Abonarea paginii la webhook a eșuat.'
        return NextResponse.redirect(process.env.APP_URL + redirectTo + '?error=' + encodeURIComponent(message))
      }

      await prisma.channel.upsert({
        where: { type_externalId: { type: 'FACEBOOK', externalId: page.id } },
        create: {
          businessId,
          type: 'FACEBOOK',
          externalId: page.id,
          accessToken: encrypt(page.access_token),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
        update: { businessId, accessToken: encrypt(page.access_token), status: 'ACTIVE', enabledByOwner: true },
      })

    }
  }

  if (provider === 'google') {
    const accounts = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).then((r) => r.json())

    const accountName = accounts.accounts?.[0]?.name // ex: "accounts/123456"

    // recenziile se cer pe LOCAȚIE, nu pe cont — trebuie numele complet al resursei
    // (ex: "accounts/123456/locations/789") ca să putem sincroniza ulterior recenziile
    let locationName = accountName ?? businessId
    if (accountName) {
      const locations = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      ).then((r) => r.json())
      locationName = locations.locations?.[0]?.name ?? locationName // ex: "accounts/123456/locations/789"
    }

    await prisma.channel.upsert({
      where: { type_externalId: { type: 'GOOGLE_BUSINESS', externalId: locationName } },
      create: {
        businessId,
        type: 'GOOGLE_BUSINESS',
        externalId: locationName,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: encrypt(tokenData.refresh_token),
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: encrypt(tokenData.refresh_token),
        status: 'ACTIVE',
      },
    })
  }

  return NextResponse.redirect(`${process.env.APP_URL}${redirectTo ?? '/dashboard/canale'}?connected=${provider}`)
}
