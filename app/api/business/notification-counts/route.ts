import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const counts = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      _count: {
        select: {
          conversations: { where: { needsOperator: true } },
          bookings: { where: { confirmationSeenByAdmin: false } },
        },
      },
    },
  })

  return NextResponse.json({
    needsOperatorCount: counts?._count.conversations ?? 0,
    unseenConfirmationsCount: counts?._count.bookings ?? 0,
  })
}
