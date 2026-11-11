import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectiveBusinessPlan, hasBusinessPlan, type BusinessPlan } from '@/lib/business-plans'
import { LockKeyhole, ArrowRight } from 'lucide-react'

export async function DashboardPlanGate({
  required,
  title,
  description,
  children,
}: {
  required: BusinessPlan
  title: string
  description: string
  children: React.ReactNode
}) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return null
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { planName: true, billingStatus: true, launchEnrollment: { select: { cancelledAt: true } } },
  })
  if (!business) return null
  const current = effectiveBusinessPlan(business, Boolean((session as any).isSuperAdmin))
  if (hasBusinessPlan(current, required)) return <>{children}</>

  return (
    <div className="dashboard-page">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#d5e6e1] bg-white p-8 text-center shadow-[0_12px_30px_#17383a12] sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f7f4] text-[#168d8d]"><LockKeyhole size={26} /></span>
        <span className="mt-5 inline-block rounded-full bg-[#e8f7f4] px-3 py-1 text-xs font-extrabold tracking-widest text-[#147f83]">{required}</span>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">{description}</p>
        <p className="mt-5 text-xs text-gray-500">Planul tău actual: {current}. Poți vedea această funcție, dar activarea ei necesită schimbarea planului.</p>
        <Link href="/dashboard/planuri" className="btn-primary mt-7 inline-flex items-center gap-2">Vezi planurile <ArrowRight size={17} /></Link>
      </div>
    </div>
  )
}
