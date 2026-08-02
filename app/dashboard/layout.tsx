import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SidebarUserBlock } from '@/components/sidebar-user-block'

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

  // super adminii "puri" (fără business propriu) nu au ce căuta în dashboard-ul de
  // business — ei gestionează conturile clienților, nu propriul calendar/servicii.
  // Îi trimitem direct în panoul lor separat.
  if (isSuperAdmin && !businessId) {
    redirect('/superadmin')
  }

  let category: 'SALON' | 'EVENT_VENUE' | null = null
  let slug: string | null = null

  if (businessId) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (business && !business.accountActive) {
      redirect('/cont-suspendat')
    }
    if (business && !business.onboardingDone) {
      redirect(`/onboarding/step-${business.onboardingStep}`)
    }
    category = business?.category ?? null
    slug = business?.slug ?? null
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.salonOnly || category === 'SALON')

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-[var(--surface-muted)]">
      <aside className="p-4 flex flex-col gap-1">
        <Link href="/dashboard" className="flex items-center gap-2 mb-1 px-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
          <span className="font-semibold text-lg">bookeasy.ro</span>
        </Link>
        {slug && (
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 px-2 mb-4 hover:text-[var(--accent)] transition truncate"
          >
            bookeasy.ro/{slug} ↗
          </a>
        )}
        {visibleNavItems.map((item) => (
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

        <SidebarUserBlock label={userEmail || 'Cont'} />
      </aside>
      <main>{children}</main>
    </div>
  )
}
