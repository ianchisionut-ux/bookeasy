import { privateJson } from '@/lib/private-json'
import { NextRequest } from 'next/server';
import { auth } from '@/lib/business-auth'
import { prisma } from '@/lib/prisma'
import { bookingSmsWhere, summarizeBookingSms, SMS_LIMITS } from '@/lib/sms-limits'

export async function GET(req: NextRequest) {
  const session = await auth() as any
  if (!session?.businessId) return privateJson({ error: 'unauthorized' }, { status: 401 })
  const ids = [...new Set((req.nextUrl.searchParams.get('ids') || '').split(',').filter(Boolean))]
  if (!ids.length || ids.length > 100 || ids.some(id => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) return privateJson({ error: 'Listă invalidă.' }, { status: 400 })
  const bookings = await prisma.booking.findMany({ where: { businessId: session.businessId, id: { in: ids } }, select: { id: true, status: true, startAt: true, customerConfirmed: true } })
  const jobs = bookings.length ? await prisma.smsJob.findMany({ where: { businessId: session.businessId, OR: bookings.map(b => bookingSmsWhere(session.businessId, b.id)) }, select: { bookingId: true, kind: true, idempotencyKey: true, createdAt: true, status:true, sentAt:true, dispatchedAt:true } }) : []
  const allowances = Object.fromEntries(bookings.map(b => {
    const allowance = summarizeBookingSms(jobs.filter(j => j.bookingId === b.id || (!j.bookingId && (j.idempotencyKey.startsWith(`confirm-${b.id}-`) || j.idempotencyKey.startsWith(`reminder-${b.id}-`)))))
    const active = ['PENDING', 'CONFIRMED'].includes(b.status) && b.startAt > new Date()
    return [b.id, { ...allowance, canRemind: active && allowance.canRemind, canReconfirm: active && b.customerConfirmed !== true && allowance.canReconfirm }]
  }))
  return privateJson({ allowances, limits: { reminders: SMS_LIMITS.reminders, reconfirmations: SMS_LIMITS.reconfirmations } }, { headers: { 'Cache-Control': 'no-store' } })
}
