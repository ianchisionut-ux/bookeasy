import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import NearbyBusinesses from '@/components/nearby-businesses'
import { PublicHeader } from '@/components/ui/public-header'
import { BackLink } from '@/components/ui/back-link'
import { CardInteractive } from '@/components/ui/card'

export default async function PublicBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { services: { where: { active: true } }, photos: { orderBy: { createdAt: 'desc' } } },
  })

  if (!business || !business.publicListed) notFound()
  if (business.category === 'HOTEL' || business.category === 'PENSIUNE') notFound() // în dezvoltare

  return (
    <>
      <PublicHeader />

      {business.heroImageUrl && (
        <div className="relative w-full h-56 lg:h-80">
          <Image src={business.heroImageUrl} alt={business.name} fill className="object-cover" priority quality={95} />
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-4 sm:mb-6">
          <BackLink href="/harta" label="Înapoi la hartă" />
        </div>

        <h1 className="text-xl sm:text-2xl font-semibold mb-1">{business.name}</h1>
        <p className="text-sm text-gray-500 mb-1">
          {business.address ?? business.city}
          {business.rating ? ` · ★ ${business.rating.toString()} (${business.reviewCount ?? 0} recenzii)` : ''}
        </p>
        {business.contactPhone && (
          <p className="text-sm text-gray-500 mb-4">
            <a href={`tel:${business.contactPhone}`} className="hover:text-[var(--accent)] transition">
              📞 {business.contactPhone}
            </a>
          </p>
        )}

        <Link href={`/${business.slug}/rezerva`} className="btn-primary inline-block mb-6">
          Rezervă acum
        </Link>

        <h2 className="text-lg font-medium mb-3">Servicii</h2>
        <div className="flex flex-col gap-2">
          {business.services.map((s) => (
            <CardInteractive key={s.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-3">
              <span className="font-medium">{s.name}</span>
              <div className="flex justify-between sm:contents text-sm text-gray-500">
                <span>{s.durationMin ? `${s.durationMin} min` : '—'}</span>
                <span className="font-medium text-gray-900">{s.price ? `${s.price} lei` : '—'}</span>
              </div>
            </CardInteractive>
          ))}
        </div>

        {business.photos.length > 0 && (
          <>
            <h2 className="text-lg font-medium mb-3 mt-8">Galerie</h2>
            <div className="grid grid-cols-3 gap-2">
              {business.photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden">
                  <Image src={p.url} alt="" fill className="object-cover" quality={90} />
                </div>
              ))}
            </div>
          </>
        )}

        <NearbyBusinesses businessId={business.id} />
      </main>
    </>
  )
}
