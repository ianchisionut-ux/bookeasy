import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { CalendarDays, Clock3, MapPin, Stethoscope, UserRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PublicHeader } from '@/components/ui/public-header'
import ConfirmationActions from './confirmation-actions'
import { expandConfirmationToken } from '@/lib/confirmation-link'

export const dynamic = 'force-dynamic'

export default async function SmsConfirmationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const token = query.token || expandConfirmationToken(id)
  if (!token) notFound()
  const include = { business: true, service: true, practitioner: true, staff: true, resource: true } as const
  const booking = query.token ? await prisma.booking.findUnique({ where: { id }, include }) : await prisma.booking.findFirst({ where: { confirmationRequestToken: token }, include })
  if (!booking || booking.confirmationRequestToken !== token || !booking.confirmationRequestSent) notFound()
  const accent = booking.business.brandColor || 'var(--accent)'
  const accentSoft = booking.business.brandColor ? `${booking.business.brandColor}1a` : 'var(--accent-soft)'
  const initials = booking.business.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  const date = booking.startAt.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: booking.business.timezone })
  const time = booking.startAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: booking.business.timezone })
  const endTime = booking.endAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: booking.business.timezone })
  const duration = Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60_000)

  return <div className="themed-static-bg min-h-screen"><PublicHeader />
    <main className="mx-auto max-w-xl px-3 py-6 sm:px-6 sm:py-10"><div className="overflow-hidden rounded-[24px] bg-white shadow-xl">
      <div className="p-5 text-white sm:p-7" style={{ background: `linear-gradient(125deg, var(--brand-ink) 0%, ${accent} 150%)` }}><div className="flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15 text-lg font-semibold">{initials}</div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Confirmare programare</p><h1 className="mt-1 text-xl font-semibold">{booking.business.name}</h1></div></div></div>
      <div className="p-5 sm:p-7"><h2 className="text-xl font-semibold">Detaliile programării</h2><div className="mt-5 grid gap-3">
        <Detail icon={<Stethoscope size={18} />} label="Serviciu" value={booking.service.name} accent={accent} soft={accentSoft} />
        {booking.practitioner && <Detail icon={<UserRound size={18} />} label="Specialist" value={booking.practitioner.name} accent={accent} soft={accentSoft} />}
        {booking.staff && <Detail icon={<UserRound size={18} />} label="Personal" value={booking.staff.name} accent={accent} soft={accentSoft} />}
        {booking.resource && <Detail icon={<MapPin size={18} />} label="Resursă" value={booking.resource.name} accent={accent} soft={accentSoft} />}
        <Detail icon={<CalendarDays size={18} />} label="Data" value={date} accent={accent} soft={accentSoft} /><Detail icon={<Clock3 size={18} />} label="Interval și durată" value={`${time} – ${endTime} · ${duration} min`} accent={accent} soft={accentSoft} />
        {booking.business.showServicePrices && booking.service.price !== null && <Detail icon={<Stethoscope size={18} />} label="Preț" value={`${booking.service.price.toString()} RON`} accent={accent} soft={accentSoft} />}
        {booking.business.address && <Detail icon={<MapPin size={18} />} label="Locație" value={booking.business.address} accent={accent} soft={accentSoft} />}
      </div><div className="mt-7">{booking.customerConfirmed !== null ? <div className="rounded-2xl bg-gray-50 p-5 text-center"><p className="font-semibold">Răspunsul a fost deja înregistrat.</p><p className="mt-1 text-sm text-gray-500">{booking.customerConfirmed ? 'Programarea este confirmată.' : 'Programarea este anulată.'}</p></div> : <ConfirmationActions bookingId={booking.id} token={token} accent={accent} />}</div></div>
    </div></main></div>
}

function Detail({ icon, label, value, accent, soft }: { icon: ReactNode; label: string; value: string; accent: string; soft: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color: accent, background: soft }}>{icon}</span><div><p className="text-xs text-gray-500">{label}</p><p className="font-medium capitalize text-gray-900">{value}</p></div></div>
}
