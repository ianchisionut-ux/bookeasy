import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import NearbyBusinesses from '@/components/nearby-businesses'
import { PublicHeader } from '@/components/ui/public-header'
import { PublicFooter } from '@/components/ui/public-footer'
import { BackLink } from '@/components/ui/back-link'
import { ArrowRight, CalendarCheck2, Clock3, MapPin, Phone, ShieldCheck, Star } from 'lucide-react'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spațiu pentru evenimente',
  CLINICA: 'Clinică medicală',
}

export default async function PublicBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { name: 'asc' } },
      photos: { orderBy: { createdAt: 'desc' } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!business || !business.publicListed) notFound()
  if (business.category === 'HOTEL' || business.category === 'PENSIUNE') notFound()

  const accent = business.brandColor || 'var(--accent)'
  const accentSoft = business.brandColor ? `${business.brandColor}1a` : 'var(--accent-soft)'
  const initials = business.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  const bookingLabel = business.category === 'CLINICA' ? 'Programează-te acum' : 'Rezervă acum'

  return (
    <div className="themed-static-bg min-h-screen">
      <PublicHeader />

      <div className="px-3 pt-4 sm:px-6 sm:pt-8">
        <section className="relative mx-auto min-h-[260px] max-w-6xl overflow-hidden rounded-[22px] shadow-xl sm:min-h-[340px] sm:rounded-[26px]">
          {business.heroImageUrl && (
            <Image src={business.heroImageUrl} unoptimized={business.heroImageUrl.startsWith('/api/storage/public/')} alt={business.name} fill className="object-cover" priority quality={95} />
          )}
          <div className="absolute inset-0" style={{ background: business.heroImageUrl ? 'linear-gradient(90deg, rgba(20,20,43,.94) 0%, rgba(20,20,43,.72) 52%, rgba(20,20,43,.2) 100%)' : `linear-gradient(125deg, #14142b 0%, ${accent} 150%)` }} />
          <div className="relative flex min-h-[260px] max-w-3xl flex-col justify-end p-5 text-white sm:min-h-[340px] sm:p-9 lg:p-11">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-white/15 text-lg font-semibold shadow-inner backdrop-blur sm:h-16 sm:w-16 sm:text-xl">{initials}</div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/65">{CATEGORY_LABEL[business.category] ?? 'Servicii locale'}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">{business.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/75">
              {(business.address || business.city) && <span className="flex items-center gap-1.5"><MapPin size={15} />{business.address ?? business.city}</span>}
              {business.rating && <span className="flex items-center gap-1.5"><Star size={15} fill="#facc15" color="#facc15" />{business.rating.toString()} · {business.reviewCount ?? 0} recenzii</span>}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href={`/${business.slug}/rezerva`} className="btn-primary inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-[#14142b] shadow-lg hover:bg-white">
                <CalendarCheck2 size={17} /> {bookingLabel} <ArrowRight size={16} />
              </Link>
              {business.contactPhone && <a href={`tel:${business.contactPhone}`} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"><Phone size={15} /> Sună acum</a>}
            </div>
          </div>
        </section>
      </div>

      <main className="mx-auto grid min-w-0 max-w-6xl gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <section className="card min-w-0 overflow-hidden p-4 sm:p-7">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>Ce poți rezerva</p>
                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Servicii disponibile</h2>
              </div>
              <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium" style={{ background: accentSoft, color: accent }}>{business.services.length} servicii</span>
            </div>
            {business.services.length === 0 ? (
              <p className="text-sm text-gray-500">Momentan nu sunt servicii publicate.</p>
            ) : (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {business.services.map((service) => (
                  <Link key={service.id} href={`/${business.slug}/rezerva`} className="group min-w-0 rounded-2xl border border-[var(--border-soft)] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-medium">{service.name}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Clock3 size={13} />{service.durationMin ? `${service.durationMin} minute` : 'Durată flexibilă'}</p>
                      </div>
                      {service.price && <span className="shrink-0 text-sm font-semibold">{service.price.toString()} lei</span>}
                    </div>
                    <p className="mt-3 flex items-center gap-1 text-xs font-medium opacity-0 transition group-hover:opacity-100" style={{ color: accent }}>Alege serviciul <ArrowRight size={13} /></p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {business.photos.length > 0 && (
            <section className="card min-w-0 overflow-hidden p-4 sm:p-7">
              <h2 className="mb-4 text-xl font-semibold">Galerie</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {business.photos.map((photo, index) => (
                  <div key={photo.id} className={`relative overflow-hidden rounded-xl ${index === 0 ? 'col-span-2 aspect-[2/1] sm:col-span-2' : 'aspect-square'}`}>
                    <Image src={photo.url} unoptimized={photo.url.startsWith('/api/storage/public/')} alt={`${business.name} – fotografie ${index + 1}`} fill className="object-cover transition duration-300 hover:scale-[1.03]" quality={90} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card min-w-0 overflow-hidden p-4 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Recenzii {business.reviewCount ? `(${business.reviewCount})` : ''}</h2>
              <Link href={`/${slug}/recenzie`} className="shrink-0 text-sm font-medium" style={{ color: accent }}>Lasă o recenzie</Link>
            </div>
            {business.reviews.length === 0 ? (
              <p className="text-sm text-gray-500">Nicio recenzie încă — fii primul!</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {business.reviews.map((review) => (
                  <article key={review.id} className="min-w-0 rounded-2xl border border-[var(--border-soft)] bg-white p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">{review.authorName}</p>
                      <p className="flex shrink-0 gap-0.5">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={13} fill={index < review.rating ? '#eab308' : 'none'} color={index < review.rating ? '#eab308' : '#d1d5db'} />)}</p>
                    </div>
                    {review.comment && <p className="break-words text-sm leading-relaxed text-gray-600">{review.comment}</p>}
                    <p className="mt-2 text-xs text-gray-400">{review.createdAt.toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}</p>
                    {review.reply && <div className="mt-3 rounded-xl p-3" style={{ background: accentSoft }}><p className="mb-1 text-xs font-medium" style={{ color: accent }}>Răspunsul afacerii</p><p className="break-words text-sm text-gray-600">{review.reply}</p></div>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <NearbyBusinesses businessId={business.id} />
        </div>

        <aside className="card min-w-0 overflow-hidden p-4 sm:p-5 lg:sticky lg:top-6">
          <BackLink href="/harta" label="Înapoi la hartă" />
          <div className="mt-5 border-t border-[var(--border-soft)] pt-5">
            <h2 className="font-semibold">Programare simplă și rapidă</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">Alege serviciul și ora potrivită, apoi confirmă cu numărul tău de telefon.</p>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p className="flex items-center gap-2"><CalendarCheck2 size={16} style={{ color: accent }} /> Programare online, oricând</p>
              <p className="flex items-center gap-2"><ShieldCheck size={16} style={{ color: accent }} /> Datele tale rămân protejate</p>
            </div>
            <Link href={`/${business.slug}/rezerva`} className="btn-primary mt-5 flex w-full items-center justify-center gap-2">{bookingLabel} <ArrowRight size={15} /></Link>
            {business.contactPhone && <a href={`tel:${business.contactPhone}`} className="btn-secondary mt-2 flex w-full items-center justify-center gap-2"><Phone size={15} /> {business.contactPhone}</a>}
          </div>
        </aside>
      </main>

      <PublicFooter />
    </div>
  )
}
