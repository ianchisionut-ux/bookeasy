import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import Link from 'next/link'
import BusinessRowActions from './business-row-actions'
import CreateBusinessButton from './create-business-button'
import { CATEGORY_LABEL } from '@/lib/business-categories'
import BusinessOverview from './business-overview'
import { LAUNCH_STAGE_LABEL, launchView, launchAdminSummary, isCurrentLaunchOffer } from '@/lib/launch-policy'
import { BusinessListRefresh } from '@/components/admin/business-list-refresh'

const STATUS_LABEL: Record<string, string> = { GRATUIT: 'Gratuit', NEPLATIT: 'Neplătit', PLATIT: 'Plătit', RESTANT: 'Restant' }
const STATUS_TONE = { GRATUIT: 'neutral', NEPLATIT: 'warning', PLATIT: 'success', RESTANT: 'danger' } as const
const PAGE_SIZE = 25

export default async function SuperAdminBusinesses({ searchParams }: { searchParams: Promise<{ neplatite?: string; q?: string; phase?: string; page?: string }> }) {
  const query = await searchParams
  const onlyUnpaid = query.neplatite === '1', search = query.q?.trim().slice(0, 150) || '', phase = query.phase || ''
  const now = new Date()
  const where: Prisma.BusinessWhereInput = {
    ...(onlyUnpaid ? { billingStatus: { in: ['NEPLATIT', 'RESTANT'] } } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }, { users: { some: { role: 'OWNER', email: { contains: search, mode: 'insensitive' } } } }] } : {}),
    ...(phase === 'onboarding' ? { onboardingDone: false } : phase === 'free' ? { launchEnrollment: { is: { cancelledAt: null, activatedAt: { not: null }, freeEndsAt: { gt: now } } } } : phase === 'promo' ? { launchEnrollment: { is: { cancelledAt: null, freeEndsAt: { lte: now }, promoEndsAt: { gt: now } } } } : phase === 'standard' ? { launchEnrollment: { is: { cancelledAt: null, promoEndsAt: { lte: now } } } } : {}),
  }
  const count = await prisma.business.count({ where })
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(query.page || '1', 10) || 1))
  const businesses = await prisma.business.findMany({ where, select: {
    users: { where: { role: 'OWNER' }, select: { email: true }, orderBy: { id: 'asc' } }, contactPhone: true,
    id: true, name: true, city: true, slug: true, category: true, teamSize: true, billingStatus: true, planName: true, publicListed: true,
    onboardingDone: true, onboardingStep: true, createdAt: true, accountActive: true, launchEnrollment: true,
    _count: { select: { bookings: true } },
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE })
  function pageLink(nextPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (phase) params.set('phase', phase)
    if (onlyUnpaid) params.set('neplatite', '1')
    params.set('page', String(nextPage))
    return `/superadmin/afaceri?${params}`
  }
  return <div className="dashboard-page">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Afaceri</h1><div className="flex flex-wrap gap-2"><Link href="/superadmin/invitatii" className="btn-secondary">Invită prin email</Link><CreateBusinessButton /></div></div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-500">{count} afaceri pentru selecția curentă · pagina {page} din {totalPages}</p><BusinessListRefresh /></div>
    <BusinessOverview />
    <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-gray-500">Caută afacere, adresă publică sau email<input name="q" defaultValue={search} maxLength={150} className="input-field w-full" placeholder="Nume / email…" /></label>
      <label className="flex flex-col gap-1 text-xs text-gray-500">Etapă<select name="phase" defaultValue={phase} className="input-field"><option value="">Toate etapele</option><option value="onboarding">În configurare</option><option value="free">Perioadă gratuită</option><option value="standard">Standard · 55 lei</option></select></label>
      <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" name="neplatite" value="1" defaultChecked={onlyUnpaid} />Doar neplătite</label><button className="btn-primary">Aplică</button><Link href="/superadmin/afaceri" className="btn-secondary">Resetează</Link>
    </form>
    <Card className="p-0 overflow-hidden printable"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b border-[var(--border-soft)] text-left text-xs text-gray-500"><th className="px-5 py-3">Afacere</th><th>Categorie / profil</th><th>Configurare</th><th>Campanie</th><th>Plată</th><th>Programări</th><th>Public</th><th><span className="sr-only">Acțiuni</span></th></tr></thead><tbody>
      {businesses.map(b => { const offer = b.launchEnrollment ? launchView(b.launchEnrollment, now) : null; return <tr key={b.id} className="border-b border-[var(--border-soft)] last:border-0 align-top"><td className="px-5 py-4"><Link href={`/superadmin/afaceri/${b.id}`} className="font-semibold text-[var(--accent-hover)]">{b.name}</Link><p className="mt-1 text-xs text-gray-500">{b.city || 'Oraș necompletat'} · /{b.slug}</p><div className="mt-2 space-y-1 text-xs">{b.users.length ? b.users.map(u=><p key={u.email}><a className="break-all text-[var(--accent-hover)] hover:underline" href={`mailto:${u.email}`}>{u.email}</a></p>) : <p className="text-gray-400">Email necompletat</p>}{b.contactPhone?.trim() ? <p><a className="text-[var(--accent-hover)] hover:underline" href={`tel:${b.contactPhone.replace(/[^+0-9]/g,'')}`}>{b.contactPhone}</a></p> : <p className="text-gray-400">Telefon necompletat</p>}</div><p className="mt-1 text-[10px] text-gray-400">Înscrisă {b.createdAt.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })}{!b.accountActive ? ' · suspendată' : ''}</p></td><td className="py-4"><p className="text-xs">{CATEGORY_LABEL[b.category]}</p><p className="mt-1 text-[10px] text-gray-500">{b.category === 'FITNESS' ? '1 instructor' : b.teamSize > 1 ? 'Echipă' : 'Individual'}</p></td><td className="py-4"><Pill tone={b.onboardingDone ? 'success' : 'warning'}>{b.onboardingDone ? 'Finalizată' : `Pasul ${Math.min(b.onboardingStep, 4)}/4`}</Pill></td><td className="py-4 text-xs">{offer ? <><strong>{b.launchEnrollment && !isCurrentLaunchOffer(b.launchEnrollment) ? 'Ofertă anterioară · ' : ''}{LAUNCH_STAGE_LABEL[offer.stage]}</strong>{offer.stage !== 'MANUAL' && <p className="mt-1 text-gray-500">{launchAdminSummary(b.launchEnrollment!, now)}</p>}</> : <span className="text-gray-400">Fără campanie</span>}</td><td className="py-4"><Pill tone={STATUS_TONE[b.billingStatus]}>{STATUS_LABEL[b.billingStatus]}</Pill><p className="mt-1 text-[10px] text-gray-500">{b.planName || '—'}</p></td><td className="py-4">{b._count.bookings}</td><td className="py-4 text-xs">{b.publicListed ? 'Da' : 'Nu'}</td><td className="pr-4 py-4"><BusinessRowActions businessId={b.id} businessName={b.name} publicListed={b.publicListed} /></td></tr> })}
      {!businesses.length && <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-500">Nicio afacere pentru filtrele alese.</td></tr>}
    </tbody></table></div></Card>
    <nav aria-label="Paginare afaceri" className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-gray-500">{count ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, count)} din {count}</span><div className="flex gap-2">{page > 1 && <Link href={pageLink(page - 1)} className="btn-secondary text-xs">Înapoi</Link>}{page < totalPages && <Link href={pageLink(page + 1)} className="btn-secondary text-xs">Următoarele 25</Link>}</div></nav>
  </div>
}
