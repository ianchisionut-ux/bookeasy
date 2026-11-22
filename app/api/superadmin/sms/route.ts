import { privateJson } from '@/lib/private-json'
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { smsJobMessage, visibleSmsStatus } from '@/lib/sms-job-status'
import { smsApiAvailability, testSmsApiConnection } from '@/lib/smsapi'

const schema = z.object({ action: z.literal('test-smsapi') }).strict()
export async function POST(req: NextRequest) {
  const session = await auth() as any
  if (!session?.isSuperAdmin) return privateJson({ error: 'unauthorized' }, { status: 403 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return privateJson({ error: 'Cerere invalidă.' }, { status: 403 })
  const input = schema.safeParse(await req.json().catch(() => null))
  if (!input.success) return privateJson({ error: 'Date invalide.' }, { status: 400 })
  const result = await testSmsApiConnection()
  const status = { accepted: 200, unconfigured: 409, rejected: 422, unavailable: 502 }[result.status]
  return privateJson(result, { status })
}

export async function GET() {
  if (!(await auth() as any)?.isSuperAdmin) return privateJson({ error: 'unauthorized' }, { status: 403 })
  const jobs = await prisma.smsJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, recipient: true, status: true, error: true, createdAt: true, dispatchedAt: true, sentAt: true, kind: true, senderKey: true } })
  return privateJson({ ...smsApiAvailability(), provider: 'smsapi', lastSeenAt: null, jobs: jobs.map(job => {
    const status = visibleSmsStatus(job)
    return { id: job.id, recipient: `•••• ${job.recipient.slice(-4)}`, status, provider: job.senderKey, message: smsJobMessage(status, job.error, job.senderKey), kind: job.kind === 'REMINDER' ? 'Reminder' : job.kind === 'RECONFIRMATION' ? 'Reconfirmare' : 'SMS', createdAt: job.createdAt, sentAt: job.sentAt }
  }) }, { headers: { 'Cache-Control': 'no-store' } })
}
