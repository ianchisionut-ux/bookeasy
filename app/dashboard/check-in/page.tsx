import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effectiveBusinessPlan } from '@/lib/business-plans'
import { isWalletEligibleCategory } from '@/lib/wallet-eligibility'
import { verifyWalletQr, walletConfigured } from '@/lib/google-wallet'
import CheckInButton from './check-in-button'

export const dynamic = 'force-dynamic'

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const session = await auth()
  const businessId = (session as { businessId?: string } | null)?.businessId
  if (!businessId) return null
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { category: true, planName: true, billingStatus: true, launchEnrollment: { select: { cancelledAt: true } } } })
  if (!business || effectiveBusinessPlan(business, Boolean((session as any)?.isSuperAdmin)) !== 'PRO') return null
  if (!isWalletEligibleCategory(business.category)) return <div className="dashboard-page"><h1 className="text-2xl font-bold">Check-in Google Wallet</h1><p className="mt-3 text-sm text-gray-600">Această categorie nu folosește carduri QR în Google Wallet.</p></div>
  if (!walletConfigured()) return <div className="dashboard-page"><h1 className="text-2xl font-bold">Check-in Google Wallet</h1><p className="mt-3 text-sm text-gray-600">Integrarea este în pregătire. Cardurile vor putea fi emise după aprobarea contului issuer și activarea serviciului.</p></div>

  const { code } = await searchParams
  const bookingId = code ? verifyWalletQr(code, businessId) : null
  const booking = bookingId ? await prisma.booking.findFirst({ where: { id: bookingId, businessId }, select: { startAt: true, status: true, arrivedAt: true, customer: { select: { name: true } }, service: { select: { name: true } } } }) : null
  return <div className="dashboard-page"><div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-6"><h1 className="text-2xl font-bold">Check-in Google Wallet</h1>{!code ? <p className="mt-3 text-sm text-gray-600">Scanează codul QR de pe cardul clientului cu camera telefonului. Linkul deschide aici rezervarea pentru verificare.</p> : !booking ? <p className="mt-3 text-sm text-red-700">Cod QR invalid sau rezervarea nu aparține acestei afaceri.</p> : <><p className="mt-4 font-semibold">{booking.customer.name ?? 'Client'} · {booking.service.name}</p><p className="mt-1 text-sm text-gray-600">{new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'full', timeStyle: 'short' }).format(booking.startAt)}</p>{booking.arrivedAt ? <p className="mt-4 text-sm text-teal-700">Sosirea a fost deja înregistrată.</p> : ['PENDING', 'CONFIRMED'].includes(booking.status) ? <CheckInButton code={code} /> : <p className="mt-4 text-sm text-red-700">Rezervarea nu mai este activă.</p>}</>}</div></div>
}
