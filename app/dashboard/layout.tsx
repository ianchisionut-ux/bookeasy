import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'
import { ExitBusinessAccessButton } from '@/components/exit-business-access-button'
import { bookingTerminology, isPatientCategory, practitionerLabel } from '@/lib/business-categories'
import { refreshLaunchIfDue } from '@/lib/launch-campaign'
import Link from 'next/link'
import { unreadGuideCount } from '@/lib/usage-guide'
import { helpUnreadCount } from '@/lib/help-chat'
import { effectiveBusinessPlan, hasBusinessPlan, type BusinessPlan } from '@/lib/business-plans'
import { isWalletEligibleCategory } from '@/lib/wallet-eligibility'
import { walletConfigured } from '@/lib/google-wallet'

// layout-ul se randează mereu din nou, la fiecare cerere — fără nicio cache, ca
// setări cum e culoarea businessului să apară imediat, nu doar la un moment ulterior
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NAV_ITEMS = [
  { href: '/dashboard/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/dashboard/mesaje', label: 'Mesaje', icon: 'mesaje' },
  { href: '/dashboard/programari', label: 'Programări', icon: 'programari' },
  { href: '/dashboard/clienti', label: 'Clienți', icon: 'clienti' },
  { href: '/dashboard/recenzii', label: 'Recenzii', icon: 'recenzii' },
  { href: '/dashboard/statistici', label: 'Statistici', icon: 'statistici' },
  { href: '/dashboard/setari', label: 'Setări', icon: 'setari' },
  { href: '/dashboard/ghid-utilizare', label: 'Ghid de utilizare', icon: 'ghid' },
  { href: '/dashboard/planuri', label: 'Planuri și upgrade', icon: 'planuri' },
]

const REQUIRED_PLAN: Record<string, BusinessPlan> = {
  '/dashboard/mesaje': 'STANDARD',
  '/dashboard/recenzii': 'STANDARD',
  '/dashboard/statistici': 'STANDARD',
  '/dashboard/medici': 'STANDARD',
  '/dashboard/fitness': 'STANDARD',
}

const CLINIC_NAV_LABEL_OVERRIDES: Record<string, string> = {
  '/dashboard/clienti': 'Pacienți',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const isSuperAdmin = (session as any)?.isSuperAdmin
  const businessId = (session as any)?.businessId
  const userEmail = (session as any)?.user?.email ?? ''
  const isImpersonatingBusiness = Boolean((session as any)?.isImpersonatingBusiness)

  if (isSuperAdmin && !businessId) {
    redirect('/superadmin')
  }

  let brandColor: string | null = null
  let businessName: string | null = null
  let category: string | null = null
  let teamSize = 1
  let needsOperatorCount = 0
  let unseenConfirmationsCount = 0
  let billingAlert: { status: string; dueAt: Date | null; amount: number | null; hasInvoice: boolean } | null = null
  let currentPlan: BusinessPlan = 'FREE'
  if (businessId) {
    await refreshLaunchIfDue(businessId)
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true, accountActive: true, onboardingDone: true, onboardingStep: true,
        brandColor: true, category: true, teamSize: true, billingStatus: true, planName: true,
        launchEnrollment: { select: { cancelledAt: true } },
        billingDueAt: true, billingAmount: true, billingInvoiceUrl: true,
        _count: {
          select: {
            conversations: { where: { needsOperator: true } },
            bookings: { where: { confirmationSeenByAdmin: false } },
          },
        },
      },
    })
    if (business && !business.accountActive && !isSuperAdmin) {
      redirect('/cont-suspendat')
    }
    if (business && !business.onboardingDone && !isSuperAdmin) {
      redirect(`/onboarding/step-${business.onboardingStep}`)
    }
    brandColor = business?.brandColor ?? null
    businessName = business?.name ?? null
    category = business?.category ?? null
    teamSize = business?.teamSize ?? 1
    if (business) currentPlan = effectiveBusinessPlan(business, isSuperAdmin)
    needsOperatorCount = business?._count.conversations ?? 0
    unseenConfirmationsCount = business?._count.bookings ?? 0
    if (business && ['NEPLATIT', 'RESTANT'].includes(business.billingStatus) && business.billingDueAt && business.billingDueAt <= new Date()) {
      billingAlert = { status: business.billingStatus, dueAt: business.billingDueAt, amount: business.billingAmount === null ? null : Number(business.billingAmount), hasInvoice: Boolean(business.billingInvoiceUrl) }
    }
  }

  const [guideUnread,supportUnread] = businessId ? await Promise.all([unreadGuideCount(businessId),helpUnreadCount(businessId)]) : [0,0]
  const navItems = [
    ...NAV_ITEMS.slice(0, 3),
    ...(category === 'FITNESS' ? [{ href: '/dashboard/fitness', label: 'Fitness & coaching', icon: 'fitness' }] : []),
    ...(category !== 'FITNESS' && teamSize > 1 ? [{ href: '/dashboard/medici', label: practitionerLabel(category).plural, icon: 'medici' }] : []),
    ...NAV_ITEMS.slice(3),
  ].map((item) => ({
      ...item,
      badge:
        item.href === '/dashboard/ghid-utilizare' ? guideUnread || undefined : item.href === '/dashboard/mesaje' && needsOperatorCount > 0
          ? needsOperatorCount
          : item.href === '/dashboard/programari' && unseenConfirmationsCount > 0
            ? unseenConfirmationsCount
            : undefined,
    }))
    .map((item) => ({
      ...item,
      lockedTo: REQUIRED_PLAN[item.href] && !hasBusinessPlan(currentPlan, REQUIRED_PLAN[item.href]) ? REQUIRED_PLAN[item.href] : undefined,
      label:
        isPatientCategory(category)
          ? CLINIC_NAV_LABEL_OVERRIDES[item.href] ?? item.label
          : item.href === '/dashboard/programari'
            ? bookingTerminology(category).heading
            : item.label,
    }))
    .concat([
      ...(isWalletEligibleCategory(category) ? [{ href: '/dashboard/check-in', label: walletConfigured() ? 'Check-in Google Wallet' : 'Google Wallet (în pregătire)', icon: 'wallet', badge: undefined, lockedTo: hasBusinessPlan(currentPlan, 'PRO') ? undefined : 'PRO' as BusinessPlan }] : []),
    ])
    .concat(isSuperAdmin ? [{ href: '/superadmin', label: 'Super Admin', badge: undefined, icon: 'superadmin', lockedTo: undefined }] : [])

  return (
    <ResponsiveShell
      logoHref="/dashboard"
      logoLabel="bookeasy.ro"
      profileName={businessName ?? undefined}
      navItems={navItems}
      currentPlan={currentPlan}
      accentColor={brandColor ?? undefined}
      accountContent={<SidebarUserBlock label={userEmail || 'Cont'} showSupport supportUnread={supportUnread} />}
      enableLiveBadges
    >
      {isImpersonatingBusiness && (
        <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 lg:mx-8">
          <span><strong>Acces Super Admin:</strong> lucrezi în contul {businessName} cu drepturi complete.</span>
          <ExitBusinessAccessButton />
        </div>
      )}
      {billingAlert && <div className="mx-4 mt-4 lg:mx-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex items-center justify-between gap-3 flex-wrap"><span><strong>Abonament scadent.</strong> {billingAlert.amount !== null ? `${billingAlert.amount.toLocaleString('ro-RO')} RON · ` : ''}Plătește în maximum 15 zile de la scadență pentru a evita suspendarea.</span><Link href="/dashboard/setari" className="font-medium underline">Vezi factura</Link></div>}
      {children}
    </ResponsiveShell>
  )
}
