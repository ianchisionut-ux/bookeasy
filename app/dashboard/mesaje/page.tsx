import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InboxManager from './inbox-manager'

export default async function MesajePage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  return <InboxManager />
}
