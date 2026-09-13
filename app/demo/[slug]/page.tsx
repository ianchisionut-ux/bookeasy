import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DemoDashboard from './demo-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Demonstrație BookEasy',
  description: 'Previzualizare fără acces la date reale sau funcții de modificare.',
  robots: { index: false, follow: false },
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { name: true, category: true, brandColor: true, teamSize: true },
  })

  if (!business) notFound()

  return (
    <DemoDashboard
      businessName={business.name}
      category={business.category}
      accentColor={business.brandColor ?? '#76b82a'}
      teamSize={business.teamSize}
    />
  )
}
