import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fitnessData, fitnessOwner } from '@/lib/fitness'
import { fitnessDate } from '@/lib/fitness-validation'
import CoachWorkspace from '@/components/fitness/coach-workspace'

export const dynamic = 'force-dynamic'
export default async function FitnessPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  if (!await auth()) redirect('/login')
  const owner = await fitnessOwner()
  // The parent layout renders the plan upgrade card for a Free business.
  if (!owner) return null
  const day = fitnessDate(new Date(), owner.timezone)
  const [data, query] = await Promise.all([fitnessData(owner.id, undefined, day), searchParams])
  const selected = data.members.find(m => m.id === query.client || m.customerId === query.client)?.id || ''
  return <CoachWorkspace initial={data} initialDay={day} initialMember={selected} />
}
