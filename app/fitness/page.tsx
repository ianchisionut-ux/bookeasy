import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fitnessClient, fitnessData } from '@/lib/fitness'
import { fitnessDate } from '@/lib/fitness-validation'
import FitnessClientWorkspace from '@/components/fitness/client-workspace'

export const dynamic = 'force-dynamic'
export default async function ClientFitnessPage() {
  const session = await auth()
  if (!session) redirect('/cont?next=/fitness')
  if ((session as any).role !== 'CUSTOMER') redirect('/dashboard')
  const profile = await fitnessClient()
  if (!profile) redirect('/cont')
  const data = await fitnessData(null, profile.id)
  return <FitnessClientWorkspace initial={data} name={session.user?.name || data.members[0]?.name || ''} initialDay={fitnessDate(new Date(), data.timezone)} />
}
