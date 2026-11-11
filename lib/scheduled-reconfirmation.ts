import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sendConfirmationRequest } from '@/lib/confirmation-request'
import { effectiveBusinessPlan } from '@/lib/business-plans'

export function isReconfirmationDue(booking: { startAt: Date; createdAt: Date; business: { reminderMinutesBefore: number } }, now: Date): boolean {
  const minutes = booking.business.reminderMinutesBefore
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 2880) return false
  const dueAt = booking.startAt.getTime() - minutes * 60_000
  // A reservation made after its reminder time must not trigger an immediate SMS.
  // An administrator may still request reconfirmation manually.
  return booking.startAt > now && booking.createdAt.getTime() < dueAt && dueAt <= now.getTime()
}

export async function sendScheduledReconfirmations(now: Date) {
  const result = { reconfirmations: 0, reconfirmationErrors: 0 }
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      customerConfirmed: null,
      confirmationRequestSent: false,
      startAt: { gt: now, lte: new Date(now.getTime() + 2880 * 60_000) },
      business: { accountActive: true, smsGatewayEnabled: true, smsReconfirmationEnabled: true },
    },
    include: { customer: true, service: true, business: { include: { launchEnrollment: { select: { cancelledAt: true } } } } },
    orderBy: { startAt: 'asc' },
  })
  for (const booking of bookings) {
    if (effectiveBusinessPlan(booking.business) === 'FREE') continue
    if (!isReconfirmationDue(booking, now)) continue
    const token = booking.confirmationRequestToken || crypto.randomUUID()
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, confirmationRequestSent: false, customerConfirmed: null, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { confirmationRequestSent: true, confirmationRequestToken: token },
    })
    if (claim.count !== 1) continue
    let sent = false
    try { sent = (await sendConfirmationRequest({ ...booking, confirmationRequestToken: token })).success }
    catch { /* Release this claim so an unavailable gateway can be retried. */ }
    if (sent) result.reconfirmations++
    else {
      await prisma.booking.updateMany({
        where: { id: booking.id, confirmationRequestToken: token, customerConfirmed: null },
        data: { confirmationRequestSent: false },
      })
      result.reconfirmationErrors++
    }
  }
  return result
}
