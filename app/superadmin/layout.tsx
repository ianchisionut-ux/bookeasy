import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'
import { helpUnreadCount } from '@/lib/help-chat'

const NAV_ITEMS = [
  { href: '/superadmin/afaceri', label: 'Afaceri', icon: 'afaceri' },
  { href: '/superadmin/invitatii', label: 'Invitații afaceri', icon: 'email' },
  { href: '/superadmin/planuri', label: 'Planuri și prețuri', icon: 'servicii' },
  { href: '/superadmin/coduri-promotionale', label: 'Coduri promoționale', icon: 'servicii' },
  { href: '/superadmin/cereri', label: 'Cereri de acces', icon: 'cereri' },
  { href: '/superadmin/tichete', label: 'Suport tehnic', icon: 'tichete' },
  { href: '/superadmin/sms', label: 'SMS', icon: 'mesaje' },
  { href: '/superadmin/email', label: 'Email', icon: 'email' },
  { href: '/superadmin/ghid-utilizare', label: 'Ghid de utilizare', icon: 'ghid' },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    redirect('/dashboard')
  }

  const userEmail = (session as any)?.user?.email ?? 'admin'
  const badgeRows = await prisma.$queryRaw<Array<{ newRequestsCount: bigint }>>`
    SELECT
      (SELECT COUNT(*) FROM "AccessRequest" WHERE status = 'NEW') AS "newRequestsCount",
      (SELECT COUNT(*) FROM "SupportTicket" WHERE status = 'NEW') AS "newTicketsCount"
  `
  const newRequestsCount = Number(badgeRows[0]?.newRequestsCount ?? 0)
  const newTicketsCount = await helpUnreadCount()
  const newEmailsCount = await prisma.platformEmail.count({ where: { folder: 'inbox', isRead: false } }).catch(() => 0)

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    badge:
      item.href === '/superadmin/cereri'
        ? newRequestsCount
        : item.href === '/superadmin/tichete'
          ? newTicketsCount
          : item.href === '/superadmin/email'
            ? newEmailsCount
          : undefined,
  }))

  return (
    <ResponsiveShell logoHref="/superadmin/afaceri" logoLabel="bookeasy.ro" profileName="Super Admin" navItems={navItems} accountContent={<SidebarUserBlock label={userEmail} />} enableLiveBadges notificationScope="superadmin">
      {children}
    </ResponsiveShell>
  )
}
