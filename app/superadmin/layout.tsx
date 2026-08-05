import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'

const NAV_ITEMS = [
  { href: '/superadmin', label: 'Prezentare generală' },
  { href: '/superadmin/afaceri', label: 'Afaceri' },
  { href: '/superadmin/cereri', label: 'Cereri de acces' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    redirect('/dashboard')
  }

  const userEmail = (session as any)?.user?.email ?? 'admin'
  const newRequestsCount = await prisma.accessRequest.count({ where: { status: 'NEW' } })

  return (
    <ResponsiveShell
      logoHref="/superadmin"
      logoLabel="Super Admin"
      content={
        <>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition flex items-center justify-between"
            >
              {item.label}
              {item.href === '/superadmin/cereri' && newRequestsCount > 0 && (
                <span className="text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {newRequestsCount}
                </span>
              )}
            </Link>
          ))}
          <SidebarUserBlock label={userEmail} />
        </>
      }
    >
      {children}
    </ResponsiveShell>
  )
}
