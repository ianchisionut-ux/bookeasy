import FitnessWorkspace from '@/components/fitness-workspace'
import { portalClient } from '@/lib/fitness-auth'
import FitnessLogout from './logout'

export const dynamic = 'force-dynamic'
export default async function Page() {
  try { await portalClient() } catch {
    return <div className="mx-auto max-w-lg p-6"><h1 className="text-xl font-semibold">Bun venit în FitEasy</h1><p className="mt-3">Solicită instructorului linkul tău privat de acces. Dacă sesiunea a expirat, ai nevoie de o invitație nouă.</p><p className="mt-3 text-sm text-gray-500">Contul de client este separat de contul instructorului.</p></div>
  }
  return <><div className="mx-auto max-w-6xl px-6 pt-4 text-right"><FitnessLogout /></div><FitnessWorkspace /></>
}
