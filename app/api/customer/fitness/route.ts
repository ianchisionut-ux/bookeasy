import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { clientIdentity } from '@/lib/client-profile'
import { fitnessClient, fitnessData, fitnessJson, hashFitnessInvite } from '@/lib/fitness'
import { fitnessDay } from '@/lib/fitness-validation'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const profile = await fitnessClient()
  if (!profile) return fitnessJson({ error: 'Autentifică-te în contul de client.' }, 401)
  const day = fitnessDay.safeParse(req.nextUrl.searchParams.get('day'))
  if (!day.success) return fitnessJson({ error: 'Data nu este validă.' }, 400)
  return fitnessJson(await fitnessData(null, profile.id, day.data))
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return fitnessJson({ error: 'Origine invalidă.' }, 403)
  const identity = clientIdentity(await auth())
  if (!identity) return fitnessJson({ error: 'Autentifică-te în contul de client.' }, 401)
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('claim'), token: z.string().regex(/^[a-f0-9]{64}$/) }),
    z.object({ action: z.literal('task'), id: z.string(), completed: z.boolean(), feedback: z.string().trim().max(2000), version: z.number().int().min(1) }),
  ]).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fitnessJson({ error: 'Date invalide.' }, 400)
  if (parsed.data.action === 'claim') {
    const inviteHash = hashFitnessInvite(parsed.data.token)
    const result = await prisma.$transaction(async tx => {
      const member = await tx.fitnessMember.findFirst({ where: { inviteHash, inviteExpiresAt: { gt: new Date() }, active: true, clientProfileId: null, business: { category: 'FITNESS', accountActive: true } } })
      if (!member) return false
      const profile = await tx.clientProfile.upsert({ where: { ownerKey: identity.ownerKey }, create: { ownerKey: identity.ownerKey, firstName: identity.firstName, lastName: identity.lastName, email: identity.email, phone: identity.phone }, update: {} })
      const claimed = await tx.fitnessMember.updateMany({ where: { id: member.id, inviteHash, clientProfileId: null, active: true, inviteExpiresAt: { gt: new Date() } }, data: { clientProfileId: profile.id, inviteHash: null, inviteExpiresAt: null } })
      return claimed.count === 1
    })
    return fitnessJson(result ? { ok: true } : { error: 'Invitația a expirat sau a fost folosită. Cere instructorului un link nou.' }, result ? 200 : 410)
  }
  const profile = await fitnessClient()
  if (!profile) return fitnessJson({ error: 'Acces interzis.' }, 403)
  const body = parsed.data
  const result = await prisma.fitnessTask.updateMany({ where: { id: body.id, version: body.version, member: { clientProfileId: profile.id, active: true, business: { category: 'FITNESS', accountActive: true } } }, data: { completed: body.completed, feedback: body.feedback, version: { increment: 1 } } })
  return fitnessJson(result.count ? { ok: true } : { error: 'Sarcina nu mai este disponibilă sau a fost modificată. Reîncarcă datele.' }, result.count ? 200 : 409)
}
