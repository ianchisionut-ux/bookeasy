import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDailyStats, getSummaryStats } from '@/lib/statsHelper'
import StatisticiCharts from './statistici-charts'

export default async function StatisticiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const [daily, summary] = await Promise.all([getDailyStats(businessId, 30), getSummaryStats(businessId)])

  return <StatisticiCharts daily={daily} summary={summary} />
}
