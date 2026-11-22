import { privateJson } from '@/lib/private-json'
import { readBusinessSmsSettings } from '@/lib/sms-routing'
import { smsApiAvailability } from '@/lib/smsapi'
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma'
import { smsJobMessage, visibleSmsStatus } from '@/lib/sms-job-status'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth() as { businessId?: string; role?: string; isSuperAdmin?: boolean } | null
  const requestedId = req.nextUrl.searchParams.get('businessId')
  const businessId = session?.isSuperAdmin && requestedId ? requestedId : session?.businessId
  if (!businessId || session?.role === 'CUSTOMER' || (requestedId && requestedId !== businessId)) return privateJson({ error: 'unauthorized' }, { status: 401 })
  const [jobs, settings] = await Promise.all([
    prisma.smsJob.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, recipient: true, status: true, error: true, createdAt: true, dispatchedAt: true, sentAt: true, idempotencyKey: true, senderKey: true } }),
    readBusinessSmsSettings(businessId),
  ])
  const availability = smsApiAvailability()
  const online = settings.smsGatewayEnabled && settings.accountActive && availability.online
  return privateJson({ online, provider: 'smsapi', lastSeenAt: null, lastError: availability.lastError, jobs: jobs.map(job => {
    const status = visibleSmsStatus(job)
    return { id: job.id, recipient: `•••• ${job.recipient.slice(-4)}`, status, provider: job.senderKey, message: smsJobMessage(status, job.error, job.senderKey), kind: job.idempotencyKey.startsWith('confirm-') ? 'Reconfirmare' : job.idempotencyKey.startsWith('reminder-') ? 'Reminder' : 'SMS', createdAt: job.createdAt, sentAt: job.sentAt }
  }) }, { headers: { 'Cache-Control': 'no-store' } })
}
