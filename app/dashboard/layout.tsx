import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'

const NAV_ITEMS = [
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/clienti', label: 'Clienți' },
  { href: '/dashboard/servicii', label: 'Servicii' },
  { href: '/dashboard/statistici', label: 'Statistici' },
  { href: '/dashboard/canale', label: 'Canale' },
  { href: '/dashboard/setari', label: 'Setări' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isSuperAdmin = (session as any)?.isSuperAdmin

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-[var(--surface-muted)]">
      <aside className="p-4 flex flex-col gap-1">
        <Link href="/dashboard" className="flex items-center gap-2 mb-5 px-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
          <span className="font-semibold text-lg">bookeasy.ro</span>
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

        {isSuperAdmin && (
          <>
            <div className="h-px bg-[var(--border-soft)] my-2" />
            <Link
              href="/superadmin"
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--accent)] hover:bg-white hover:shadow-sm transition"
            >
              Super Admin
            </Link>
          </>
        )}
      </aside>
      <main>{children}</main>
    </div>
  )
}
