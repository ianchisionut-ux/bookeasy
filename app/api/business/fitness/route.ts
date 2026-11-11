import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { fitnessData, fitnessJson, fitnessOwner, fitnessSecret, hashFitnessInvite } from '@/lib/fitness'
import { fitnessDay, memberSchema, moveFitnessDay, planSchema, progressSchema, taskSchema } from '@/lib/fitness-validation'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const owner = await fitnessOwner()
  if (!owner) return fitnessJson({ error: 'Modul disponibil doar afacerilor Fitness active.' }, 403)
  const day = fitnessDay.safeParse(req.nextUrl.searchParams.get('day'))
  if (!day.success) return fitnessJson({ error: 'Data nu este validă.' }, 400)
  return fitnessJson(await fitnessData(owner.id, undefined, day.data))
}

const mutationSchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('member'), id: z.string().optional(), data: memberSchema }),
  z.object({ entity: z.literal('plan'), id: z.string().optional(), data: planSchema }),
  z.object({ entity: z.literal('task'), id: z.string().optional(), version: z.number().int().optional(), repeat: z.number().int().min(1).max(28).default(1), intervalDays: z.union([z.literal(1), z.literal(7)]).default(7), data: taskSchema }),
  z.object({ entity: z.literal('progress'), data: progressSchema }),
  z.object({ entity: z.literal('invite'), id: z.string() }),
  z.object({ entity: z.literal('disconnect'), id: z.string() }),
])

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return fitnessJson({ error: 'Origine invalidă.' }, 403)
  const owner = await fitnessOwner()
  if (!owner) return fitnessJson({ error: 'Modul disponibil doar afacerilor Fitness active.' }, 403)
  const parsed = mutationSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fitnessJson({ error: 'Verifică datele introduse.', fields: parsed.error.flatten() }, 400)
  const body = parsed.data
  const memberId = 'data' in body && 'memberId' in body.data ? body.data.memberId : 'id' in body ? body.id : undefined
  const member = memberId ? await prisma.fitnessMember.findFirst({ where: { id: memberId, businessId: owner.id } }) : null
  if (body.entity !== 'member' && !member) return fitnessJson({ error: 'Client inexistent.' }, 404)
  try {
    if (body.entity === 'member') {
      const customer = await prisma.customer.findFirst({ where: { id: body.data.customerId, businessId: owner.id } })
      if (!customer) return fitnessJson({ error: 'Client inexistent.' }, 404)
      if (body.id) {
        const result = await prisma.fitnessMember.updateMany({ where: { id: body.id, businessId: owner.id, customerId: customer.id }, data: body.data })
        if (!result.count) return fitnessJson({ error: 'Fișă inexistentă.' }, 404)
      } else await prisma.fitnessMember.create({ data: { ...body.data, businessId: owner.id } })
    } else if (body.entity === 'plan') {
      if (body.id) {
        const result = await prisma.fitnessPlan.updateMany({ where: { id: body.id, memberId: member!.id, kind: body.data.kind }, data: { title: body.data.title, details: body.data.details } })
        if (!result.count) return fitnessJson({ error: 'Plan inexistent.' }, 404)
      } else await prisma.fitnessPlan.create({ data: body.data })
    } else if (body.entity === 'task') {
      if (body.data.planId && !await prisma.fitnessPlan.findFirst({ where: { id: body.data.planId, memberId: member!.id, kind: body.data.kind } })) return fitnessJson({ error: 'Planul nu aparține clientului sau tipului de sarcină.' }, 400)
      const { video, ...data } = body.data
      if (body.id) {
        const existing = await prisma.fitnessTask.findFirst({ where: { id: body.id, memberId: member!.id } })
        if (!existing) return fitnessJson({ error: 'Sarcină inexistentă.' }, 404)
        const result = await prisma.fitnessTask.updateMany({ where: { id: body.id, memberId: member!.id, version: body.version ?? -1 }, data: { ...data, planId: data.planId || null, videoRoom: video ? existing.videoRoom || fitnessSecret() : null, version: { increment: 1 } } })
        if (!result.count) return fitnessJson({ error: 'Sarcina a fost modificată între timp. Reîncarcă datele.' }, 409)
      } else await prisma.fitnessTask.createMany({ data: Array.from({ length: body.repeat }, (_, index) => ({ ...data, day: moveFitnessDay(data.day, index * body.intervalDays), planId: data.planId || null, videoRoom: video ? fitnessSecret() : null })) })
    } else if (body.entity === 'progress') {
      await prisma.fitnessProgress.upsert({ where: { memberId_day: { memberId: member!.id, day: body.data.day } }, create: body.data, update: { weightKg: body.data.weightKg, note: body.data.note } })
    } else if (body.entity === 'disconnect') {
      await prisma.fitnessMember.update({ where: { id: member!.id }, data: { clientProfileId: null, inviteHash: null, inviteExpiresAt: null } })
    } else {
      if (!member!.active || member!.clientProfileId) return fitnessJson({ error: 'Activează clientul și revocă accesul anterior înainte de a genera o invitație nouă.' }, 409)
      const token = fitnessSecret()
      await prisma.fitnessMember.update({ where: { id: member!.id }, data: { inviteHash: hashFitnessInvite(token), inviteExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } })
      // Origin comes from the request, never from an unvalidated contact or redirect field.
      return fitnessJson({ inviteUrl: `${req.nextUrl.origin}/fitness/activare#${token}` })
    }
    return fitnessJson({ ok: true })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return fitnessJson({ error: 'Clientul are deja o fișă Fitness.' }, 409)
    console.error('[fitness] mutation failed', error)
    return fitnessJson({ error: 'Salvarea nu a reușit. Încearcă din nou.' }, 500)
  }
}

export async function DELETE(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return fitnessJson({ error: 'Origine invalidă.' }, 403)
  const owner = await fitnessOwner()
  if (!owner) return fitnessJson({ error: 'Acces interzis.' }, 403)
  const body = z.object({ entity: z.enum(['task', 'plan']), id: z.string() }).safeParse(await req.json().catch(() => null))
  if (!body.success) return fitnessJson({ error: 'Date invalide.' }, 400)
  const where = { id: body.data.id, member: { businessId: owner.id } }
  const result = body.data.entity === 'task' ? await prisma.fitnessTask.deleteMany({ where }) : await prisma.fitnessPlan.deleteMany({ where })
  return fitnessJson(result.count ? { ok: true } : { error: 'Element inexistent.' }, result.count ? 200 : 404)
}
