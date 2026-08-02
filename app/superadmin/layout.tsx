import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SidebarUserBlock } from '@/components/sidebar-user-block'

const NAV_ITEMS = [
  { href: '/superadmin', label: 'Prezentare generală' },
  { href: '/superadmin/afaceri', label: 'Afaceri' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    redirect('/dashboard')
  }

  const userEmail = (session as any)?.user?.email ?? 'admin'

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

        <SidebarUserBlock label={userEmail} />
      </aside>
      <main>{children}</main>
    </div>
  )
}
