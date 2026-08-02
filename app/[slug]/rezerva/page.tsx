import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PublicHeader } from '@/components/ui/public-header'
import { BackLink } from '@/components/ui/back-link'
import BookingFlow from './booking-flow'

export default async function RezervaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { services: { where: { active: true }, orderBy: { name: 'asc' } } },
  })

  if (!business || !business.publicListed || !business.accountActive) notFound()

  return (
    <>
      <PublicHeader />
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-4 sm:mb-6">
          <BackLink href={`/${slug}`} label={`Înapoi la ${business.name}`} />
        </div>

        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Rezervă la {business.name}</h1>
        <p className="text-sm text-gray-500 mb-5 sm:mb-6">Alege serviciul, data și ora care ți se potrivesc.</p>

        <BookingFlow
          businessId={business.id}
          businessSlug={business.slug}
          category={business.category}
          services={business.services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMin: s.durationMin,
            price: s.price ? Number(s.price) : null,
            requiresDeposit: s.requiresDeposit,
            depositAmount: s.depositAmount ? Number(s.depositAmount) : null,
          }))}
          canPayOnline={!!business.paymentProcessor}
        />
      </main>
    </>
  )
}
