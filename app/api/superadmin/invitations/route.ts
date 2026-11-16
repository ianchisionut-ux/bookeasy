import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAction } from '@/lib/admin-action'
import { InvitationError, listInvitations, sendBusinessInvitation } from '@/lib/business-invitations'
import { getPlanPrices } from '@/lib/plan-pricing'
import { prisma } from '@/lib/prisma'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().max(100).optional(), offeredPlan: z.enum(['FREE', 'STANDARD', 'PRO']).default('STANDARD'), headerImageUrl: z.string().max(255).optional() }).strict(),
  z.object({ action: z.literal('resend'), id: z.string().uuid() }),
  z.object({ action: z.literal('revoke'), id: z.string().uuid() }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  z.object({ action: z.literal('restore'), id: z.string().uuid() }),
])

export async function GET(req: NextRequest) {
  const denied = await adminAction(req)
  if (denied) return denied
  return NextResponse.json({ invitations: await listInvitations(), prices: await getPlanPrices() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const denied = await adminAction(req, true)
  if (denied) return denied
  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Verifică adresa de email, planul și antetul invitației.' }, { status: 400 })
  try {
    const data = parsed.data
    if (data.action === 'invite') {
      await sendBusinessInvitation(data.email, data.name, undefined, data.offeredPlan, data.headerImageUrl)
    } else if (data.action === 'delete') {
      const count = await prisma.$executeRaw`UPDATE "BusinessInvitation" SET "deletedAt"=clock_timestamp(),"revokedAt"=COALESCE("revokedAt",clock_timestamp()) WHERE "id"=${data.id} AND "deletedAt" IS NULL`
      if (!count) throw new InvitationError('Invitația nu există.', 404)
    } else if (data.action === 'restore') {
      await prisma.$executeRaw`UPDATE "BusinessInvitation" SET "deletedAt"=NULL WHERE "id"=${data.id}`
    } else if (data.action === 'revoke') {
      await prisma.$executeRaw`UPDATE "BusinessInvitation" SET "revokedAt"=clock_timestamp() WHERE "id"=${data.id} AND "acceptedAt" IS NULL`
    } else {
      const rows = await prisma.$queryRaw<{ email: string; name: string; offeredPlan: 'FREE' | 'STANDARD' | 'PRO' | 'CAMPAIGN'; promoCode: string | null; headerImageUrl: string | null }[]>`SELECT "email","name","offeredPlan","promoCode","headerImageUrl" FROM "BusinessInvitation" WHERE "id"=${data.id} AND "deletedAt" IS NULL`
      if (!rows[0]) throw new InvitationError('Invitația nu există.', 404)
      if (rows[0].offeredPlan === 'CAMPAIGN') throw new InvitationError('Invitațiile cu campanie nu mai pot fi retrimise.', 409)
      await sendBusinessInvitation(rows[0].email, rows[0].name, undefined, rows[0].offeredPlan, rows[0].headerImageUrl ?? undefined)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Operațiunea nu a putut fi finalizată. Reîncearcă mai târziu.' }, { status: 503 })
  }
}
