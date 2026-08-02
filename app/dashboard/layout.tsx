import Link from 'next/link'
import Image from 'next/image'

const NAV_ITEMS = [
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/clienti', label: 'Clienți' },
  { href: '/dashboard/servicii', label: 'Servicii' },
  { href: '/dashboard/statistici', label: 'Statistici' },
  { href: '/dashboard/canale', label: 'Canale' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen">
      <aside className="border-r border-gray-200 p-4 flex flex-col gap-1">
        <Link href="/dashboard" className="flex items-center gap-2 mb-4">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
          <span className="font-medium text-lg">bookeasy.ro</span>
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-md text-sm hover:bg-gray-100"
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <main>{children}</main>
    </div>
  )
}
