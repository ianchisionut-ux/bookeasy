import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import NearbyBusinesses from '@/components/nearby-businesses'

export default async function PublicBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { services: { where: { active: true } } },
  })

  if (!business || !business.publicListed) notFound()

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-1">{business.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {business.address ?? business.city}
        {business.rating ? ` · ★ ${business.rating.toString()} (${business.reviewCount ?? 0} recenzii)` : ''}
      </p>

      <h2 className="text-lg font-medium mb-3">Servicii</h2>
      <div className="flex flex-col gap-2">
        {business.services.map((s) => (
          <div key={s.id} className="border rounded-lg px-4 py-3 flex justify-between text-sm">
            <span>{s.name}</span>
            <span className="text-gray-500">{s.durationMin ? `${s.durationMin} min` : '—'}</span>
            <span>{s.price ? `${s.price} lei` : '—'}</span>
          </div>
        ))}
      </div>

      <NearbyBusinesses businessId={business.id} />
    </main>
  )
}
