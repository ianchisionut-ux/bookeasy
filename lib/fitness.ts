import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma } from './prisma'
import { clientIdentity } from './client-profile'
import { fitnessDate, moveFitnessDay } from './fitness-validation'
import type { FitnessData } from './fitness-types'
import { businessHasPlan } from './business-plan-access'

export const fitnessHeaders = { 'Cache-Control': 'private, no-store' }
export function fitnessJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: fitnessHeaders })
}
export function hashFitnessInvite(value: string) { return createHash('sha256').update(value).digest('hex') }
export function fitnessSecret() { return randomBytes(32).toString('hex') }

export async function fitnessOwner() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!session || (session as any).role === 'CUSTOMER' || !businessId) return null
  if (!(await businessHasPlan(businessId, 'STANDARD', Boolean((session as any).isSuperAdmin)))) return null
  return prisma.business.findFirst({ where: { id: businessId, category: 'FITNESS', accountActive: true }, select: { id: true, name: true, timezone: true } })
}

export async function fitnessClient() {
  const identity = clientIdentity(await auth())
  if (!identity) return null
  // Access is explicitly claimed with an expiring invitation, never inferred from email.
  return prisma.clientProfile.findUnique({ where: { ownerKey: identity.ownerKey }, select: { id: true } })
}

export async function fitnessData(businessId: string | null, profileId?: string, day?: string): Promise<FitnessData> {
  const where = businessId ? { businessId } : { clientProfileId: profileId ?? '', active: true, business: { category: 'FITNESS' as const, accountActive: true } }
  const members = await prisma.fitnessMember.findMany({
    where,
    include: { customer: { select: { name: true, phone: true, email: true } }, business: { select: { timezone: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const ids = members.map(m => m.id)
  const timezone = businessId ? (await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } }))?.timezone ?? 'Europe/Bucharest' : members[0]?.business.timezone ?? 'Europe/Bucharest'
  const current = day ?? fitnessDate(new Date(), timezone)
  const [plans, tasks, progress, customers, bookings] = await Promise.all([
    prisma.fitnessPlan.findMany({ where: { memberId: { in: ids } }, orderBy: { updatedAt: 'desc' } }),
    prisma.fitnessTask.findMany({ where: { memberId: { in: ids }, day: { gte: moveFitnessDay(current, -7), lte: moveFitnessDay(current, 7) } }, orderBy: [{ day: 'asc' }, { time: 'asc' }] }),
    prisma.fitnessProgress.findMany({ where: { memberId: { in: ids } }, orderBy: { day: 'desc' }, take: 200 }),
    businessId ? prisma.customer.findMany({ where: { businessId }, select: { id: true, name: true, phone: true }, orderBy: { name: 'asc' } }) : [],
    businessId ? prisma.booking.findMany({ where: { businessId, status: { not: 'CANCELLED' }, startAt: { gte: new Date(`${moveFitnessDay(current, -1)}T00:00:00Z`), lt: new Date(`${moveFitnessDay(current, 2)}T00:00:00Z`) } }, include: { customer: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { startAt: 'asc' } }) : [],
  ])
  return {
    timezone, businessName: members[0]?.business.name,
    members: members.map(m => ({ id: m.id, customerId: m.customerId, name: m.customer.name || 'Client', email: businessId ? m.customer.email ?? '' : '', phone: businessId ? m.customer.phone : '', goal: m.goal, ...(businessId ? { coachNotes: m.coachNotes } : {}), active: m.active, instructorName: m.business.name, connected: Boolean(m.clientProfileId) })),
    plans: plans.map(p => ({ id: p.id, memberId: p.memberId, kind: p.kind as 'WORKOUT' | 'NUTRITION', title: p.title, details: p.details })),
    tasks: tasks.map(({ videoRoom, updatedAt, ...task }) => ({ ...task, kind: task.kind as 'WORKOUT' | 'NUTRITION' | 'HABIT', hasVideo: Boolean(videoRoom) })),
    progress, ...(businessId ? { customers, bookings: bookings.map(b => ({ id: b.id, customerId: b.customerId, title: `${b.contactName || b.customer.name || 'Client'} · ${b.service.name}`, startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString() })) } : {}),
  }
}
