import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'

const NAV_ITEMS = [
  { href: '/superadmin', label: 'Prezentare generală' },
  { href: '/superadmin/afaceri', label: 'Afaceri' },
  { href: '/superadmin/cereri', label: 'Cereri de acces' },
  { href: '/superadmin/tichete', label: 'Tichete suport' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    redirect('/dashboard')
  }

  const userEmail = (session as any)?.user?.email ?? 'admin'
  const newRequestsCount = await prisma.accessRequest.count({ where: { status: 'NEW' } })
  const newTicketsCount = await prisma.supportTicket.count({ where: { status: 'NEW' } })

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    badge:
      item.href === '/superadmin/cereri'
        ? newRequestsCount
        : item.href === '/superadmin/tichete'
          ? newTicketsCount
          : undefined,
  }))

  return (
    <ResponsiveShell logoHref="/superadmin" logoLabel="bookeasy.ro" profileName="Super Admin" navItems={navItems} accountContent={<SidebarUserBlock label={userEmail} />}>
      {children}
    </ResponsiveShell>
  )
}
