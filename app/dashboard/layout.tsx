import Link from 'next/link'

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
        <p className="font-medium text-lg mb-4">bookeasy.ro</p>
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
