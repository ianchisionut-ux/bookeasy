import { auth } from '@/lib/auth'
import { PublicHeader } from '@/components/ui/public-header'
import CustomerAccount from './customer-account'
import { getClientProfile } from '@/lib/client-profile'
import ClientPageLinks from '@/components/client-page-links'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { clientIdentity } from '@/lib/client-profile'
import { Dumbbell, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomerAccountPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; deleted?: string }> }) {
  const [session, query] = await Promise.all([auth(), searchParams])
  const customer = (session as any)?.role === 'CUSTOMER'
  const role = (session as any)?.role
  if (role === 'SUPER_ADMIN') redirect('/superadmin/afaceri')
  if (role === 'OWNER' || role === 'STAFF') redirect('/dashboard')
  if (customer && query.next === '/fitness') redirect('/fitness')
  const profile = await getClientProfile(session)
  const identity = clientIdentity(session)
  const hasFitness = identity ? await prisma.fitnessMember.findFirst({ where: { active: true, clientProfile: { ownerKey: identity.ownerKey }, business: { category: 'FITNESS', accountActive: true } }, select: { id: true } }) : null
  return (
    <div className="themed-static-bg min-h-screen">
      <PublicHeader />
      <main className="public-flow-page mx-auto max-w-md px-4 py-8 sm:py-12">
        {!session && <div className="mb-6 flex rounded-full bg-gray-100 p-1" role="group" aria-label="Tipul contului"><span aria-current="page" className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-[var(--accent-hover)] shadow-sm">Utilizator</span><Link href="/login" className="flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold text-gray-600 hover:text-gray-900">Business</Link></div>}
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent-hover)]">BookEasy · cont de utilizator</p>
        <h1 className="text-3xl font-semibold tracking-tight">Contul meu</h1>
        <p className="mt-2 mb-6 text-sm text-gray-600">{customer ? 'Gestionează profilul și programările tale.' : 'Intră în contul de utilizator pentru a face și gestiona programări. Pentru afacere, alege Business la autentificare.'}</p>
        {!session && ['customer', 'business'].includes(query.deleted ?? '') && <p role="status" className="mb-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">{query.deleted === 'business' ? 'Contul afacerii a fost șters. Accesul echipei și pagina publică au fost eliminate.' : 'Contul personal BookEasy a fost șters. Ai fost deconectat.'}</p>}
        {hasFitness && <Link href="/fitness" className="card mb-5 flex items-center gap-3 p-5 text-[var(--brand-teal-dark)]"><Dumbbell size={24} /><span className="flex-1"><strong className="block text-sm">Programul meu Fitness</strong><span className="text-xs text-gray-500">Antrenamente, nutriție și sarcini zilnice</span></span><ArrowRight size={18} /></Link>}
        <CustomerAccount
          email={customer ? session?.user?.email ?? null : null}
          name={profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null : null}
          googleAccount={customer && Boolean((session as any)?.googleSub)}
          businessSession={Boolean(session && !customer)}
          googleAvailable={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          oauthError={Boolean(query.error)}
          profile={profile}
          returnTo={query.next === '/fitness' ? '/fitness' : '/cont'}
        />
        <ClientPageLinks className="mt-6" />
      </main>
    </div>
  )
}
