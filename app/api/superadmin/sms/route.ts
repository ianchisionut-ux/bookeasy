import { privateJson } from '@/lib/private-json'
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeSmsPhone } from '@/lib/sms-gateway'
import { createSmsDeviceToken } from '@/lib/sms-device-auth'
import { z } from 'zod'
import { smsJobMessage, visibleSmsStatus } from '@/lib/sms-job-status'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settings'), phone: z.string().transform(normalizeSmsPhone).refine(v => /^\+[1-9]\d{7,14}$/.test(v)), enabled: z.boolean() }),
  z.object({ action: z.literal('pair') }),
])
export async function POST(req: NextRequest) {
  const session = await auth() as any
  if (!session?.isSuperAdmin) return privateJson({ error: 'unauthorized' }, { status: 403 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return privateJson({ error: 'Cerere invalidă.' }, { status: 403 })
  const input = schema.safeParse(await req.json().catch(() => null))
  if (!input.success) return privateJson({ error: 'Date invalide.' }, { status: 400 })
  const data = input.data
  const existing = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' } })
  if (data.action === 'settings') {
    const changed = existing?.phone !== data.phone
    await prisma.platformSmsGateway.upsert({ where: { id: 'central' }, create: { id: 'central', phone: data.phone, enabled: data.enabled }, update: { phone: data.phone, enabled: data.enabled, ...(changed ? { lastSeenAt: null, tokenHash: null, lastError: null } : {}) } })
    return privateJson({ success: true })
  }
  if (!existing?.phone || !existing.enabled) return privateJson({ error: 'Salvează numărul central și activează gatewayul înainte de asociere.' }, { status: 400 })
  const { token, hash } = createSmsDeviceToken('platform')
  await prisma.platformSmsGateway.update({ where: { id: 'central' }, data: { tokenHash: hash, lastSeenAt: null, lastError: null } })
  return privateJson({ token })
}

export async function GET() {
  if (!(await auth() as any)?.isSuperAdmin) return privateJson({ error: 'unauthorized' }, { status: 403 })
  const [gateway, jobs] = await Promise.all([
    prisma.platformSmsGateway.findUnique({ where: { id: 'central' } }),
    prisma.smsJob.findMany({ where: { senderKey: 'platform' }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, recipient: true, status: true, error: true, createdAt: true, dispatchedAt: true, sentAt: true, kind: true } }),
  ])
  return privateJson({ online: Boolean(gateway?.enabled && gateway.lastSeenAt && Date.now() - gateway.lastSeenAt.getTime() < 120_000), lastSeenAt: gateway?.lastSeenAt ?? null, lastError: gateway?.lastError ?? null, jobs: jobs.map(job => {
    const status = visibleSmsStatus(job)
    return { id: job.id, recipient: `•••• ${job.recipient.slice(-4)}`, status, message: smsJobMessage(status, job.error), kind: job.kind === 'REMINDER' ? 'Reminder' : job.kind === 'RECONFIRMATION' ? 'Reconfirmare' : 'SMS', createdAt: job.createdAt, sentAt: job.sentAt }
  }) }, { headers: { 'Cache-Control': 'no-store' } })
}
