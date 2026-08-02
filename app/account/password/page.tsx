import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PasswordForm from './password-form'
import { BackLink } from '@/components/ui/back-link'

export default async function ChangePasswordPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isSuperAdmin = (session as any).isSuperAdmin
  const backHref = isSuperAdmin ? '/superadmin' : '/dashboard'

  return (
    <div className="min-h-screen bg-[var(--surface-muted)] p-4 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-sm">
        <div className="mb-4">
          <BackLink href={backHref} label="Înapoi" />
        </div>
        <PasswordForm />
      </div>
    </div>
  )
}
