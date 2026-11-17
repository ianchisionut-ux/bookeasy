import { after, NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/business-auth'
import { prisma } from '@/lib/prisma'
import { syncBookingToGoogle } from '@/lib/google-calendar'

export const maxDuration = 300

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const series = await prisma.bookingSeries.findFirst({ where: { id, businessId } })
  if (!series) return NextResponse.json({ error: 'Seria nu a fost găsită.' }, { status: 404 })

  const now = new Date()
  const cancelledIds = await prisma.$transaction(async (tx) => {
    const future = await tx.booking.findMany({
      where: { businessId, seriesId: id, startAt: { gt: now }, status: { in: ['CONFIRMED', 'PENDING'] } },
      select: { id: true },
    })
    await tx.booking.updateMany({
      where: { id: { in: future.map((booking) => booking.id) } },
      data: { status: 'CANCELLED' },
    })
    await tx.bookingSeries.update({ where: { id }, data: { stoppedAt: now } })
    return future.map((booking) => booking.id)
  })

  after(async () => {
    const calendarConnected = await prisma.googleCalendarConnection.count({ where: { businessId, syncEnabled: true } })
    if (!calendarConnected) return
    for (let index = 0; index < cancelledIds.length; index += 5) {
      await Promise.all(cancelledIds.slice(index, index + 5).map((bookingId) => syncBookingToGoogle(bookingId)))
    }
  })
  return NextResponse.json({ cancelled: cancelledIds.length })
}
