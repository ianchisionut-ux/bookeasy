import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SignOutButton } from '@/components/sign-out-button'

const NAV_ITEMS = [
  { href: '/superadmin', label: 'Prezentare generală' },
  { href: '/superadmin/afaceri', label: 'Afaceri' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-[var(--surface-muted)]">
      <aside className="p-4 flex flex-col gap-1">
        <Link href="/superadmin" className="flex items-center gap-2 mb-5 px-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
          <span className="font-semibold text-lg">Super Admin</span>
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition"
          >
            {item.label}
          </Link>
        ))}

        <div className="mt-auto pt-2">
          <div className="h-px bg-[var(--border-soft)] mb-2" />
          <SignOutButton className="w-full" />
        </div>
      </aside>
      <main>{children}</main>
    </div>
  )
}
