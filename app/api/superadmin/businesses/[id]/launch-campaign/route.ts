import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { lockLaunchBusiness, syncLaunchInTransaction } from '@/lib/launch-campaign'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  const { id: businessId } = await params
  const parsed = z.discriminatedUnion('action', [z.object({ action: z.literal('pay'), periodId: z.string().min(1) }), z.object({ action: z.literal('manual') }), z.object({ action: z.literal('refresh') })]).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  const body = parsed.data
  const result = await prisma.$transaction(async tx => {
    await lockLaunchBusiness(tx, businessId)
    const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId } })
    if (!enrollment || enrollment.cancelledAt) return { error: 'Afacerea nu are o campanie activă.', status: 409 }
    const now = new Date()
    await syncLaunchInTransaction(tx, businessId, now)
    if (body.action === 'manual') { await tx.launchEnrollment.update({ where: { id: enrollment.id }, data: { cancelledAt: now, nextSyncAt: null } }); return { ok: true, status: 200 } }
    if (body.action === 'pay') {
      const period = await tx.launchBillingPeriod.findFirst({ where: { id: body.periodId, enrollmentId: enrollment.id, amountMinor: { gt: 0 } } })
      if (!period) return { error: 'Perioada nu aparține acestei afaceri.', status: 404 }
      await tx.launchBillingPeriod.updateMany({ where: { id: period.id, paidAt: null }, data: { paidAt: now } })
      const fresh = await tx.launchEnrollment.findUniqueOrThrow({ where: { businessId } })
      if (fresh.billingCycle === period.cycle) await tx.business.update({ where: { id: businessId }, data: { billingStatus: 'PLATIT', billingPaidAt: now } })
      await syncLaunchInTransaction(tx, businessId, now)
      const overdue = await tx.launchBillingPeriod.count({ where: { enrollmentId: enrollment.id, amountMinor: { gt: 0 }, paidAt: null, startsAt: { lte: new Date(now.getTime() - 15 * 86400000) } } })
      if (!overdue) await tx.business.updateMany({ where: { id: businessId, billingSuspendedAt: { not: null } }, data: { accountActive: true, billingSuspendedAt: null } })
    }
    return { ok: true, status: 200 }
  }, { timeout: 20000 })
  return NextResponse.json(result, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
