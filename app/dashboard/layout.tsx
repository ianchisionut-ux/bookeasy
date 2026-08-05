import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'

const NAV_ITEMS = [
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/programari', label: 'Programări' },
  { href: '/dashboard/clienti', label: 'Clienți' },
  { href: '/dashboard/servicii', label: 'Servicii' },
  { href: '/dashboard/recenzii', label: 'Recenzii' },
  { href: '/dashboard/statistici', label: 'Statistici' },
  { href: '/dashboard/setari', label: 'Setări' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const isSuperAdmin = (session as any)?.isSuperAdmin
  const businessId = (session as any)?.businessId
  const userEmail = (session as any)?.user?.email ?? ''

  if (isSuperAdmin && !businessId) {
    redirect('/superadmin')
  }

  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { accountActive: true, onboardingDone: true, onboardingStep: true },
    })
    if (business && !business.accountActive) {
      redirect('/cont-suspendat')
    }
    if (business && !business.onboardingDone) {
      redirect(`/onboarding/step-${business.onboardingStep}`)
    }
  }

  const navItems = [
    ...NAV_ITEMS,
    ...(isSuperAdmin ? [{ href: '/superadmin', label: 'Super Admin' }] : []),
  ]

  return (
    <ResponsiveShell
      logoHref="/dashboard"
      logoLabel="bookeasy.ro"
      navItems={navItems}
      accountContent={<SidebarUserBlock label={userEmail || 'Cont'} />}
    >
      {children}
    </ResponsiveShell>
  )
}
