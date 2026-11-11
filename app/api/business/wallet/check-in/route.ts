import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/business-auth'
import { prisma } from '@/lib/prisma'
import { isWalletEligibleCategory } from '@/lib/wallet-eligibility'
import { verifyWalletQr, walletConfigured } from '@/lib/google-wallet'

export async function POST(req: NextRequest) {
  const session = await auth('PRO')
  const businessId = (session as { businessId?: string } | null)?.businessId
  if (!businessId) return NextResponse.json({ error: 'Planul Pro este necesar.' }, { status: 403 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (!walletConfigured()) return NextResponse.json({ error: 'Google Wallet nu este încă activ.' }, { status: 503 })
  const input = await req.json().catch(() => ({})) as { code?: unknown }
  const bookingId = typeof input.code === 'string' ? verifyWalletQr(input.code, businessId) : null
  if (!bookingId) return NextResponse.json({ error: 'Cod QR invalid.' }, { status: 400 })

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId },
    select: { id: true, startAt: true, endAt: true, status: true, arrivedAt: true, business: { select: { category: true } } },
  })
  if (!booking || !isWalletEligibleCategory(booking.business.category)) return NextResponse.json({ error: 'Rezervarea nu a fost găsită.' }, { status: 404 })
  const now = new Date()
  if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.endAt.getTime() < now.getTime() - 60 * 60_000 || booking.startAt.getTime() > now.getTime() + 24 * 60 * 60_000) {
    return NextResponse.json({ error: 'Rezervarea nu este valabilă pentru check-in acum.' }, { status: 409 })
  }
  if (booking.arrivedAt) return NextResponse.json({ error: 'Check-in deja înregistrat.' }, { status: 409 })
  const changed = await prisma.booking.updateMany({
    where: { id: booking.id, businessId, arrivedAt: null, status: { in: ['PENDING', 'CONFIRMED'] } },
    data: { arrivedAt: now },
  })
  if (changed.count !== 1) return NextResponse.json({ error: 'Check-in deja înregistrat sau rezervarea a fost modificată.' }, { status: 409 })
  return NextResponse.json({ success: true, arrivedAt: now.toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } })
}
