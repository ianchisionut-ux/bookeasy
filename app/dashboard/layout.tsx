import Link from 'next/link'
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
  { href: '/dashboard/echipa', label: 'Echipă', salonOnly: true },
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

  let category: 'SALON' | 'EVENT_VENUE' | null = null
  let teamSize = 1

  if (businessId) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (business && !business.accountActive) {
      redirect('/cont-suspendat')
    }
    if (business && !business.onboardingDone) {
      redirect(`/onboarding/step-${business.onboardingStep}`)
    }
    category = business?.category ?? null
    teamSize = business?.teamSize ?? 1
  }

  // "Echipă" are sens doar pentru saloane cu mai mult de 1 membru — o afacere
  // individuală (teamSize 1) n-are ce gestiona acolo
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.salonOnly || (category === 'SALON' && teamSize > 1))

  return (
    <ResponsiveShell logoHref="/dashboard" logoLabel="bookeasy.ro"
      content={
        <>
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition block"
            >
              {item.label}
            </Link>
          ))}

          {isSuperAdmin && (
            <>
              <div className="h-px bg-[var(--border-soft)] my-2" />
              <Link
                href="/superadmin"
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--accent)] hover:bg-white hover:shadow-sm transition block"
              >
                Super Admin
              </Link>
            </>
          )}

          <SidebarUserBlock label={userEmail || 'Cont'} />
        </>
      }
    >
      {children}
    </ResponsiveShell>
  )
}
