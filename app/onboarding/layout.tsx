import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const businessId = (session as any).businessId
  const business = businessId ? await prisma.business.findUnique({ where: { id: businessId } }) : null

  if (business?.onboardingDone) redirect('/dashboard')

  return (
    <main className="themed-static-bg flex min-h-screen flex-col items-center px-3 py-6 sm:px-6 sm:py-10">
      <Link href="/" className="mb-5 flex min-h-11 items-center gap-2 sm:mb-8">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} /><span className="font-semibold">bookeasy.ro</span>
      </Link>
      <div className="w-full max-w-lg">{children}</div>
    </main>
  )
}
