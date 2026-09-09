import { redirect } from 'next/navigation'
import { instructor } from '@/lib/fitness-auth'
import FitnessWorkspace from '@/components/fitness-workspace'

export default async function Page() {
  try { await instructor() } catch { redirect('/dashboard') }
  return <FitnessWorkspace owner />
}
