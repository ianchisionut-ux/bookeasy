import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PublicHeader } from '@/components/ui/public-header'
import { PublicFooter } from '@/components/ui/public-footer'
import { BackLink } from '@/components/ui/back-link'
import BookingFlow from './booking-flow'
import { ensureVenueService } from '@/lib/venue-services'
import { CalendarCheck2, Check, Clock3, ShieldCheck } from 'lucide-react'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
  CLINICA: 'Clinică medicală',
}

const WEEKDAY_SHORT = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']

function summarizeOpenDays(workingHours: { weekday: number }[]) {
  const openDays = [...new Set(workingHours.map((h) => h.weekday))].sort((a, b) => a - b)
  if (openDays.length === 0) return null
  if (openDays.length === 7) return 'Deschis zilnic'
  const first = openDays[0]
  const last = openDays[openDays.length - 1]
  const isConsecutive = openDays.every((d, i) => i === 0 || d === openDays[i - 1] + 1)
  if (isConsecutive) return `Deschis ${WEEKDAY_SHORT[first]}–${WEEKDAY_SHORT[last]}`
  return `Deschis ${openDays.map((d) => WEEKDAY_SHORT[d]).join(', ')}`
}

export default async function RezervaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { name: 'asc' } },
      resources: { orderBy: { name: 'asc' } },
      workingHours: true,
    },
  })

  if (!business || !business.publicListed || !business.accountActive) notFound()
  if (business.category === 'HOTEL' || business.category === 'PENSIUNE') notFound()

  const venueServices = business.category === 'EVENT_VENUE'
    ? await Promise.all(business.resources.map(async (resource) => ({ resource, service: await ensureVenueService(resource) })))
    : []

  const initials = business.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  const openSummary = summarizeOpenDays(business.workingHours)
  const accent = business.brandColor || 'var(--accent)'
  const accentSoft = business.brandColor ? `${business.brandColor}1a` : 'var(--accent-soft)'

  return (
    <div className="themed-static-bg min-h-screen">
      <PublicHeader />

      <div className="px-3 pt-4 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[22px] px-4 py-5 shadow-xl sm:rounded-[26px] sm:px-8 sm:py-8" style={{ background: `linear-gradient(125deg, #14142b 0%, ${accent} 150%)` }}>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15 text-xl font-semibold text-white shadow-inner backdrop-blur">{initials}</div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Programare online</p>
              <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">{business.name}</h1>
              <p className="mt-1 text-sm text-white/75">{CATEGORY_LABEL[business.category]}{openSummary ? ` · ${openSummary}` : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto grid min-w-0 max-w-6xl gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside className="card min-w-0 overflow-hidden p-4 sm:p-5 lg:sticky lg:top-6">
          <BackLink href={`/${slug}`} label={`Înapoi la ${business.name}`} />
          <div className="mt-5 border-t border-[var(--border-soft)] pt-5">
            <h2 className="font-semibold">Rezervă în câteva momente</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Alegi serviciul, medicul și ora potrivită. Confirmarea ajunge pe telefon.</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-700"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: accentSoft, color: accent }}><CalendarCheck2 size={15} /></span>Alegi serviciul și medicul</div>
              <div className="flex items-center gap-3 text-sm text-gray-700"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: accentSoft, color: accent }}><Clock3 size={15} /></span>Selectezi data și ora</div>
              <div className="flex items-center gap-3 text-sm text-gray-700"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: accentSoft, color: accent }}><Check size={15} /></span>Completezi datele și confirmi</div>
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500"><ShieldCheck size={16} className="mt-0.5 shrink-0" style={{ color: accent }} />Datele tale sunt folosite numai pentru gestionarea programării.</div>
          </div>
        </aside>

        <section className="card min-w-0 overflow-hidden p-4 sm:p-7 lg:p-8">
          <BookingFlow
            businessId={business.id}
            businessSlug={business.slug}
            category={business.category}
            isMultiPractitioner={business.teamSize > 1}
            accentColor={accent}
            accentSoftColor={accentSoft}
            services={(business.category === 'EVENT_VENUE' ? venueServices.map(({ resource, service }) => ({
              id: service.id,
              resourceId: resource.id,
              name: resource.name,
              durationMin: 60,
              price: resource.basePrice ? Number(resource.basePrice) : null,
              requiresDeposit: service.requiresDeposit,
              depositAmount: service.depositAmount ? Number(service.depositAmount) : null,
            })) : business.services.map((service) => ({
              id: service.id,
              resourceId: null,
              name: service.name,
              durationMin: service.durationMin,
              price: service.price ? Number(service.price) : null,
              requiresDeposit: service.requiresDeposit,
              depositAmount: service.depositAmount ? Number(service.depositAmount) : null,
            })))}
            canPayOnline={!!business.paymentProcessor}
          />
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
