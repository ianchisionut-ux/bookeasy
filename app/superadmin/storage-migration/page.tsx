import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import StorageMigrationControls from './storage-migration-controls'
import StorageUrlMigrationControls from './storage-url-migration-controls'
import PrivateBlobPurgeControls from './private-blob-purge-controls'
import PublicArchiveControls from './public-archive-controls'

// Temporary operator console for the one-time Blob to R2 transfer.
export default async function StorageMigrationPage() {
  const session = await auth()
  if (!session || !(session as { isSuperAdmin?: boolean }).isSuperAdmin) redirect('/login')
  return <>
    <StorageMigrationControls />
    <div className="mx-auto max-w-3xl px-6 pb-10 text-sm text-slate-800"><StorageUrlMigrationControls /></div>
    <PrivateBlobPurgeControls />
    <PublicArchiveControls />
  </>
}
