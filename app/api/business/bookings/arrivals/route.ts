import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  const businessId = (session as { businessId?: string } | null)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const now = Date.now()
  const arrivals = await prisma.booking.findMany({
    where: {
      businessId,
      arrivedAt: { not: null },
      status: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { gte: new Date(now - 24 * 60 * 60_000), lte: new Date(now + 24 * 60 * 60_000) },
    },
    select: { id: true, arrivedAt: true },
  })
  return NextResponse.json({ arrivals }, { headers: { 'Cache-Control': 'private, no-store' } })
}
