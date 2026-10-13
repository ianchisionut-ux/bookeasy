import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`review-lookup:${ip}`, 20, 10 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Prea multe încercări.' }, { status: 429 })

  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 })
  const session = await auth()
  const googleSub = (session as any)?.role === 'CUSTOMER' ? (session as any)?.googleSub : null
  if (typeof googleSub !== 'string' || !googleSub) return NextResponse.json({ error: 'Conectează-te cu Google pentru a vedea rezervările tale.' }, { status: 401 })

  const business = await prisma.business.findUnique({ where: { slug } })
  if (!business || !business.publicListed) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: business.id,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      endAt: { lte: new Date() },
      review: null,
      reviewerGoogleSub: googleSub,
    },
    include: { service: true },
    orderBy: { startAt: 'desc' },
    take: 5,
  })

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      serviceName: b.service.name,
      date: b.startAt.toISOString(),
    })),
  })
}
