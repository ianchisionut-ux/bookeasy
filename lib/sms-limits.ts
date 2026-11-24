import { visibleSmsStatus } from '@/lib/sms-job-status'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { smsApiDailyLimit } from '@/lib/smsapi'

export const SMS_LIMITS = { reminders: 1, reconfirmations: 1, bookingCooldownMs: 15 * 60_000, businessDaily: 50, recipientDaily: 10 } as const
export type SmsPurpose = 'REMINDER' | 'RECONFIRMATION' | 'OTHER'
export type SmsActivity = { status: string; requestedAt: string; sentAt: string | null }
export type SmsAllowance = { lastReminder: SmsActivity | null; lastReconfirmation: SmsActivity | null; lastReminderSentAt: string | null; lastReconfirmationSentAt: string | null; remindersLeft: number; reconfirmationsLeft: number; cooldownUntil: string | null; canRemind: boolean; canReconfirm: boolean }

export function bookingSmsWhere(businessId: string, bookingId: string) {
  return { businessId, OR: [{ bookingId }, { bookingId: null, idempotencyKey: { startsWith: `confirm-${bookingId}-` } }, { bookingId: null, idempotencyKey: { startsWith: `reminder-${bookingId}-` } }] }
}


type SmsHistoryEntry = {
  kind: string
  idempotencyKey: string
  createdAt: Date
  status: string
  senderKey: string | null
  sentAt: Date | null
  dispatchedAt: Date | null
}

export function summarizeBookingSms(jobs: SmsHistoryEntry[], now = new Date()): SmsAllowance {
  const currentTime = now.getTime()
  const attempts = jobs
    .map(job => ({ createdAt: job.createdAt, status: visibleSmsStatus(job, currentTime) }))
    .filter(job => job.status !== 'RETIRED')
  const latest = attempts.reduce((value, job) => Math.max(value, job.createdAt.getTime()), 0)
  const cooldown = latest ? latest + SMS_LIMITS.bookingCooldownMs : 0
  const remaining = attempts.some(job => !['FAILED', 'EXPIRED'].includes(job.status)) ? 0 : 1
  const canSend = remaining > 0 && cooldown <= currentTime

  const history = (kind: 'REMINDER' | 'RECONFIRMATION', prefix: string) => jobs
    .filter(job => job.kind === kind || job.idempotencyKey.startsWith(prefix))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const activity = (job: SmsHistoryEntry | undefined): SmsActivity | null => job ? {
    status: visibleSmsStatus(job, currentTime),
    requestedAt: job.createdAt.toISOString(),
    sentAt: job.sentAt?.toISOString() ?? null,
  } : null
  const lastSent = (rows: SmsHistoryEntry[]) => rows.reduce((latest, job) =>
    Math.max(latest, job.sentAt?.getTime() ?? 0), 0)

  const reminders = history('REMINDER', 'reminder-')
  const reconfirmations = history('RECONFIRMATION', 'confirm-')
  const lastReminderSent = lastSent(reminders)
  const lastReconfirmationSent = lastSent(reconfirmations)
  return {
    lastReminder: activity(reminders[0]),
    lastReconfirmation: activity(reconfirmations[0]),
    lastReminderSentAt: lastReminderSent ? new Date(lastReminderSent).toISOString() : null,
    lastReconfirmationSentAt: lastReconfirmationSent ? new Date(lastReconfirmationSent).toISOString() : null,
    remindersLeft: remaining,
    reconfirmationsLeft: remaining,
    cooldownUntil: cooldown > currentTime ? new Date(cooldown).toISOString() : null,
    canRemind: canSend,
    canReconfirm: canSend,
  }
}

async function readBookingSmsAllowance(businessId: string, bookingId: string, db: Prisma.TransactionClient) {
  const jobs = await db.smsJob.findMany({
    where: bookingSmsWhere(businessId, bookingId),
    select: { kind: true, idempotencyKey: true, createdAt: true, status: true, sentAt: true, dispatchedAt: true, senderKey: true },
  })
  return summarizeBookingSms(jobs)
}

export async function enqueueLimitedSms(data: { businessId: string; recipient: string; message: string; idempotencyKey: string; bookingId?: string; kind: SmsPurpose; expiresAt?: Date }) {
  return prisma.$transaction(async tx => {
    // The same lock protects all entry points, including cron, retries and multiple tabs.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sms-quota:${data.businessId}`}, 0))`
    const existing = await tx.smsJob.findUnique({ where: { businessId_idempotencyKey: { businessId: data.businessId, idempotencyKey: data.idempotencyKey } } })
    if (existing) return existing
    const now = new Date(), since = new Date(now.getTime() - 24 * 60 * 60_000)
    const [daily, recipient] = await Promise.all([
      tx.smsJob.count({ where: { businessId: data.businessId, createdAt: { gte: since } } }),
      tx.smsJob.count({ where: { businessId: data.businessId, recipient: data.recipient, createdAt: { gte: since } } }),
    ])
    if (daily >= SMS_LIMITS.businessDaily) throw new Error('Limita afacerii este de 50 de SMS-uri în 24 de ore. Încearcă mai târziu.')
    if (recipient >= SMS_LIMITS.recipientDaily) throw new Error('Acest număr a atins limita de 10 SMS-uri de la afacere în 24 de ore.')
    if (data.bookingId) {
      const booking = await tx.booking.findFirst({ where: { id: data.bookingId, businessId: data.businessId, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gt: now } }, select: { id: true } })
      if (!booking) throw new Error('Programarea nu mai este activă sau este în trecut.')
      const allowance = await readBookingSmsAllowance(data.businessId, data.bookingId, tx)
      if (!allowance.remindersLeft) throw new Error('Programarea a folosit deja SMS-ul disponibil pentru reminder sau reconfirmare.')
      if (allowance.cooldownUntil) throw new Error('Așteaptă 15 minute între solicitările SMS pentru aceeași programare.')
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('smsapi:daily-quota', 0))`
    const attempts = await tx.smsJob.count({ where: { senderKey: 'smsapi', createdAt: { gte: since } } })
    if (attempts >= smsApiDailyLimit()) throw new Error('Plafonul BookEasy pentru SMSAPI în ultimele 24 de ore a fost atins.')
    return tx.smsJob.create({ data: { ...data, senderKey: 'smsapi' } })
  }, { timeout: 15_000 })
}

async function smsHasExpired(tx: Prisma.TransactionClient, candidate: { bookingId: string | null; idempotencyKey: string; businessId: string; expiresAt: Date | null; kind: string }, now: Date) {
  if (candidate.expiresAt && candidate.expiresAt <= now) return true
  const bookingId = candidate.bookingId || /^(?:confirm|reminder)-([a-z0-9]+)-/i.exec(candidate.idempotencyKey)?.[1]
  if (!bookingId) return false
  const booking = await tx.booking.findFirst({ where: { id: bookingId, businessId: candidate.businessId }, select: { status: true, startAt: true, confirmationRequestToken: true } })
  return !booking
    || !['PENDING', 'CONFIRMED'].includes(booking.status)
    || booking.startAt <= now
    || Boolean(candidate.expiresAt && candidate.expiresAt.getTime() !== booking.startAt.getTime())
    || ((candidate.kind === 'RECONFIRMATION' || candidate.idempotencyKey.startsWith('confirm-')) && candidate.idempotencyKey !== `confirm-${bookingId}-${booking.confirmationRequestToken}`)
}

export async function claimSmsApiJob(id: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('smsapi:daily-quota', 0))`
    const now = new Date()
    const where = { id, senderKey: 'smsapi', status: 'PENDING', dispatchedAt: null, business: { accountActive: true, smsGatewayEnabled: true } }
    const job = await tx.smsJob.findFirst({ where })
    if (!job) return false
    const expiredBeforeDispatch = visibleSmsStatus(job, now.getTime()) === 'EXPIRED'
    const expired = expiredBeforeDispatch || await smsHasExpired(tx, job, now)
    if (!expired) {
      const dispatched = await tx.smsJob.count({ where: { senderKey: 'smsapi', dispatchedAt: { gte: new Date(now.getTime() - 86_400_000) } } })
      if (dispatched >= smsApiDailyLimit()) throw new Error('Plafonul BookEasy pentru SMSAPI în ultimele 24 de ore a fost atins.')
    }
    const updated = await tx.smsJob.updateMany({ where, data: expired
      ? { status: 'EXPIRED', error: expiredBeforeDispatch
        ? 'Cererea a expirat înainte de expediere. SMS-ul nu a fost trimis.'
        : 'Programarea sau linkul nu mai este valabil. SMS-ul nu a fost trimis.' }
      : { status: 'DISPATCHED', dispatchedAt: now },
    })
    return !expired && updated.count === 1
  })
}
