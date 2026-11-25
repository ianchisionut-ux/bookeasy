import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import StorageMigrationControls from './storage-migration-controls'

// Temporary operator console for the one-time Blob to R2 transfer.
export default async function StorageMigrationPage() {
  const session = await auth()
  if (!session || !(session as { isSuperAdmin?: boolean }).isSuperAdmin) redirect('/login')
  return <StorageMigrationControls />
}
