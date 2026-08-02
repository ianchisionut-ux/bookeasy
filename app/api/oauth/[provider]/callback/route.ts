import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: 'google' | 'meta' }> }) {
  const { provider } = await params
  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')
  if (!code || !stateRaw) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/canale?error=missing_code`)
  }

  const { businessId } = JSON.parse(Buffer.from(stateRaw, 'base64url').toString())
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

  if (provider === 'meta') {
    const longLived = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    ).then((r) => r.json())

    const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longLived.access_token}`).then((r) =>
      r.json()
    )

    for (const page of pages.data ?? []) {
      await prisma.channel.upsert({
        where: { type_externalId: { type: 'FACEBOOK', externalId: page.id } },
        create: {
          businessId,
          type: 'FACEBOOK',
          externalId: page.id,
          accessToken: encrypt(page.access_token),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
        update: { accessToken: encrypt(page.access_token), status: 'ACTIVE' },
      })
    }
  }

  if (provider === 'google') {
    const locations = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).then((r) => r.json())

    const externalId = locations.accounts?.[0]?.name ?? businessId

    await prisma.channel.upsert({
      where: { type_externalId: { type: 'GOOGLE_BUSINESS', externalId } },
      create: {
        businessId,
        type: 'GOOGLE_BUSINESS',
        externalId,
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

  return NextResponse.redirect(`${process.env.APP_URL}/dashboard/canale?connected=${provider}`)
}
