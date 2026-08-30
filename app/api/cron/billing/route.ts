import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { sendBillingDueEmail } from '@/lib/email'

const DAY = 24 * 60 * 60 * 1000
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const now = new Date()
  const due = await prisma.business.findMany({ where: { billingStatus: { in: ['NEPLATIT','RESTANT'] }, billingDueAt: { not: null, lte: now } }, include: { users: { where: { role: 'OWNER' }, select: { email: true } } } })
  let notified=0, suspended=0
  for (const business of due) {
    if (!business.billingDueNotifiedAt) {
      const owner=business.users[0]
      if (owner) { try { await sendBillingDueEmail({to:owner.email,businessName:business.name,amount:business.billingAmount===null?null:Number(business.billingAmount),dueAt:business.billingDueAt!}) } catch(e){ console.error('Eroare notificare scadență:',e) } }
      await prisma.business.update({where:{id:business.id},data:{billingDueNotifiedAt:now,billingStatus:'RESTANT'}});notified++
    } else if (business.billingStatus !== 'RESTANT') await prisma.business.update({where:{id:business.id},data:{billingStatus:'RESTANT'}})
    if (business.accountActive && now.getTime() >= business.billingDueAt!.getTime() + 15*DAY) {
      await prisma.business.update({where:{id:business.id},data:{accountActive:false,billingSuspendedAt:now,billingStatus:'RESTANT'}});suspended++
    }
  }
  return NextResponse.json({checked:due.length,notified,suspended})
}
