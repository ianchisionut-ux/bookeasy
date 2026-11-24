import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createBookingWalletLink, verifyBookingWalletRedirectToken } from '@/lib/google-wallet'

const noStore = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!id || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: 'Linkul Wallet nu este valid.' }, { status: 404, headers: noStore })

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { service: { select: { name: true } }, business: { include: { launchEnrollment: { select: { cancelledAt: true } } } } },
  })
  if (!booking || booking.status === 'CANCELLED' || !verifyBookingWalletRedirectToken(booking.id, booking.businessId, token)) {
    return NextResponse.json({ error: 'Linkul Wallet nu este valid.' }, { status: 404, headers: noStore })
  }

  try {
    const walletUrl = await createBookingWalletLink({
      id: booking.id,
      startAt: booking.startAt,
      endAt: booking.endAt,
      serviceName: booking.service.name,
      business: booking.business,
    }, req.nextUrl.origin)
    if (!walletUrl) return NextResponse.json({ error: 'Google Wallet nu este disponibil pentru această rezervare.' }, { status: 404, headers: noStore })
    return NextResponse.redirect(walletUrl, { status: 302, headers: noStore })
  } catch (error) {
    console.error('[google-wallet] unable to prepare booking pass:', error)
    return NextResponse.json({ error: 'Nu am putut pregăti permisul. Încearcă din nou.' }, { status: 503, headers: noStore })
  }
}
