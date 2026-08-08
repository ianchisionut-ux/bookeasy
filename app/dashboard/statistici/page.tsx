import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getDailyStats, getSummaryStats } from '@/lib/statsHelper'
import StatisticiCharts from './statistici-charts'

export default async function StatisticiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const [business, daily, summary] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true } }),
    getDailyStats(businessId, 30),
    getSummaryStats(businessId),
  ])

  return <StatisticiCharts daily={daily} summary={summary} isClinic={business?.category === 'CLINICA'} />
}
