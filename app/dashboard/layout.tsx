import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'

// layout-ul se randează mereu din nou, la fiecare cerere — fără nicio cache, ca
// setări cum e culoarea businessului să apară imediat, nu doar la un moment ulterior
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NAV_ITEMS = [
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/programari', label: 'Programări' },
  { href: '/dashboard/clienti', label: 'Clienți' },
  { href: '/dashboard/servicii', label: 'Servicii' },
  { href: '/dashboard/recenzii', label: 'Recenzii' },
  { href: '/dashboard/statistici', label: 'Statistici' },
  { href: '/dashboard/setari', label: 'Setări' },
]

const CLINIC_NAV_LABEL_OVERRIDES: Record<string, string> = {
  '/dashboard/clienti': 'Pacienți',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const isSuperAdmin = (session as any)?.isSuperAdmin
  const businessId = (session as any)?.businessId
  const userEmail = (session as any)?.user?.email ?? ''

  if (isSuperAdmin && !businessId) {
    redirect('/superadmin')
  }

  let brandColor: string | null = null
  let category: string | null = null
  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { accountActive: true, onboardingDone: true, onboardingStep: true, brandColor: true, category: true },
    })
    if (business && !business.accountActive) {
      redirect('/cont-suspendat')
    }
    if (business && !business.onboardingDone) {
      redirect(`/onboarding/step-${business.onboardingStep}`)
    }
    brandColor = business?.brandColor ?? null
    category = business?.category ?? null
  }

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    label: category === 'CLINICA' ? CLINIC_NAV_LABEL_OVERRIDES[item.href] ?? item.label : item.label,
  })).concat(isSuperAdmin ? [{ href: '/superadmin', label: 'Super Admin' }] : [])

  return (
    <ResponsiveShell
      logoHref="/dashboard"
      logoLabel="bookeasy.ro"
      navItems={navItems}
      accentColor={brandColor ?? undefined}
      accountContent={<SidebarUserBlock label={userEmail || 'Cont'} />}
    >
      {children}
    </ResponsiveShell>
  )
}
