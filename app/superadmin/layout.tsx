import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
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

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.href === '/superadmin/cereri' ? newRequestsCount : undefined,
  }))

  return (
    <ResponsiveShell logoHref="/superadmin" logoLabel="Super Admin" navItems={navItems} accountContent={<SidebarUserBlock label={userEmail} />}>
      {children}
    </ResponsiveShell>
  )
}
