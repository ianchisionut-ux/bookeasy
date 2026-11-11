import { visibleSmsStatus } from '@/lib/sms-job-status'
import { prisma } from '@/lib/prisma'

export const SMS_LIMITS = { reminders: 3, reconfirmations: 2, bookingCooldownMs: 15 * 60_000, businessDaily: 50, recipientDaily: 10, dispatchGapMs: 60_000, senderHourly: 30, senderDaily: 200 } as const
export type SmsPurpose = 'REMINDER' | 'RECONFIRMATION' | 'OTHER'
export type SmsActivity = { status: string; requestedAt: string; sentAt: string | null }
export type SmsAllowance = { lastReminder: SmsActivity | null; lastReconfirmation: SmsActivity | null; lastReminderSentAt: string | null; lastReconfirmationSentAt: string | null; remindersLeft: number; reconfirmationsLeft: number; cooldownUntil: string | null; canRemind: boolean; canReconfirm: boolean }

export function bookingSmsWhere(businessId: string, bookingId: string) {
  return { businessId, OR: [{ bookingId }, { bookingId: null, idempotencyKey: { startsWith: `confirm-${bookingId}-` } }, { bookingId: null, idempotencyKey: { startsWith: `reminder-${bookingId}-` } }] }
}

export function summarizeBookingSms(jobs: { kind: string; idempotencyKey: string; createdAt: Date; status?: string; sentAt?: Date | null; dispatchedAt?: Date | null }[], now = new Date()): SmsAllowance {
  // Attempts already handed to the queue count even if the phone later reports an error.
  const reminders = jobs.filter(j => j.kind === 'REMINDER' || j.idempotencyKey.startsWith('reminder-')).length
  const confirmations = jobs.filter(j => j.kind === 'RECONFIRMATION' || j.idempotencyKey.startsWith('confirm-')).length
  const latest = jobs.reduce((value, job) => Math.max(value, job.createdAt.getTime()), 0)
  const cooldown = latest ? latest + SMS_LIMITS.bookingCooldownMs : 0
  const remindersLeft = Math.max(0, SMS_LIMITS.reminders - reminders)
  const reconfirmationsLeft = Math.max(0, SMS_LIMITS.reconfirmations - confirmations)
  const newest = (kind: string) => [...jobs].filter(j => j.kind === kind || j.idempotencyKey.startsWith(kind === 'REMINDER' ? 'reminder-' : 'confirm-')).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())
  const activity = (j: typeof jobs[number] | undefined): SmsActivity | null => j ? {status: visibleSmsStatus({status:j.status || 'PENDING',dispatchedAt:j.dispatchedAt || null},now.getTime()),requestedAt:j.createdAt.toISOString(),sentAt:j.sentAt?.toISOString() || null} : null
  const remindersHistory=newest('REMINDER'), confirmationHistory=newest('RECONFIRMATION')
  const lastSent = (rows: typeof jobs) => rows.filter(j=>j.sentAt).sort((a,b)=>b.sentAt!.getTime()-a.sentAt!.getTime())[0]?.sentAt?.toISOString() || null
  return { lastReminder: activity(remindersHistory[0]), lastReconfirmation: activity(confirmationHistory[0]), lastReminderSentAt:lastSent(remindersHistory), lastReconfirmationSentAt:lastSent(confirmationHistory), remindersLeft, reconfirmationsLeft, cooldownUntil: cooldown > now.getTime() ? new Date(cooldown).toISOString() : null, canRemind: remindersLeft > 0 && cooldown <= now.getTime(), canReconfirm: reconfirmationsLeft > 0 && cooldown <= now.getTime() }
}

export async function readBookingSmsAllowance(businessId: string, bookingId: string, db: any = prisma) {
  return summarizeBookingSms(await db.smsJob.findMany({ where: bookingSmsWhere(businessId, bookingId), select: { kind: true, idempotencyKey: true, createdAt: true, status:true, sentAt:true, dispatchedAt:true } }))
}

export async function enqueueLimitedSms(data: { businessId: string; senderKey: string; senderPhone: string; recipient: string; message: string; idempotencyKey: string; bookingId?: string; kind: SmsPurpose; expiresAt?: Date }) {
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
      if (data.kind === 'REMINDER' && !allowance.remindersLeft) throw new Error('Limita de 3 remindere SMS pentru această programare a fost atinsă.')
      if (data.kind === 'RECONFIRMATION' && !allowance.reconfirmationsLeft) throw new Error('Limita de 2 reconfirmări SMS pentru această programare a fost atinsă.')
      if (allowance.cooldownUntil) throw new Error('Așteaptă 15 minute între solicitările SMS pentru aceeași programare.')
    }
    return tx.smsJob.create({ data })
  }, { timeout: 15_000 })
}

export async function claimNextSms(device: { id: string; smsGatewayPhone: string | null }) {
  const phone = device.smsGatewayPhone
  if (device.id !== 'platform' || !phone) return { job: null, nextPollSeconds: 30 }
  // Pending legacy jobs also move to the single central sender when atomically claimed.
  const scope = {}
  return prisma.$transaction(async tx => {
    // Lock by verified telephone number so two tokens/apps cannot bypass the dispatch pace.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sms-dispatch:${phone}`}, 0))`
    const now = new Date(), hour = new Date(now.getTime() - 3_600_000), day = new Date(now.getTime() - 86_400_000)
    const sentScope = { OR: [{ senderPhone: phone }, { senderPhone: null, ...scope }] }
    const [latest, hourly, daily] = await Promise.all([
      tx.smsJob.findFirst({ where: { ...sentScope, dispatchedAt: { not: null } }, orderBy: { dispatchedAt: 'desc' }, select: { dispatchedAt: true, status: true } }),
      tx.smsJob.count({ where: { ...sentScope, dispatchedAt: { gte: hour } } }),
      tx.smsJob.count({ where: { ...sentScope, dispatchedAt: { gte: day } } }),
    ])
    if (hourly >= SMS_LIMITS.senderHourly || daily >= SMS_LIMITS.senderDaily) return { job: null, nextPollSeconds: 30, queueState: 'VOLUME_LIMIT' }
    const interval = latest?.status === 'DISPATCHED' ? Math.max(SMS_LIMITS.dispatchGapMs, 120_000) : SMS_LIMITS.dispatchGapMs
    const wait = latest?.dispatchedAt ? interval - (now.getTime() - latest.dispatchedAt.getTime()) : 0
    if (wait > 0) return { job: null, nextPollSeconds: Math.min(60, Math.max(12, Math.ceil(wait / 1000))), queueState: 'SPACING' }
    const candidates = await tx.smsJob.findMany({ where: { ...scope, status: 'PENDING', business: { accountActive: true, smsGatewayEnabled: true } }, orderBy: { createdAt: 'asc' }, take: 10 })
    for (const candidate of candidates) {
      const bookingId = candidate.bookingId || /^(?:confirm|reminder)-([a-z0-9]+)-/i.exec(candidate.idempotencyKey)?.[1]
      if (bookingId) {
        const booking = await tx.booking.findFirst({ where: { id: bookingId, businessId: candidate.businessId }, select: { status: true, startAt: true, confirmationRequestToken: true } })
        const stale = !booking || !['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startAt <= now || (candidate.expiresAt && (candidate.expiresAt <= now || candidate.expiresAt.getTime() !== booking.startAt.getTime())) || ((candidate.kind === 'RECONFIRMATION' || candidate.idempotencyKey.startsWith('confirm-')) && candidate.idempotencyKey !== `confirm-${bookingId}-${booking.confirmationRequestToken}`)
        if (stale) {
          await tx.smsJob.updateMany({ where: { id: candidate.id, status: 'PENDING' }, data: { status: 'EXPIRED', error: 'Programarea sau linkul nu mai este valabil. SMS-ul nu a fost trimis.' } })
          continue
        }
      }
      const claimed = await tx.smsJob.updateMany({ where: { id: candidate.id, ...scope, status: 'PENDING', business: { accountActive: true, smsGatewayEnabled: true } }, data: { status: 'DISPATCHED', dispatchedAt: now, senderPhone: phone, senderKey: 'platform' } })
      if (claimed.count === 1) return { job: { id: candidate.id, to: candidate.recipient, text: candidate.message }, nextPollSeconds: 60 }
    }
    return { job: null, nextPollSeconds: 15 }
  }, { timeout: 15_000 })
}
