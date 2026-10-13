import { auth } from '@/lib/auth'
import { PublicHeader } from '@/components/ui/public-header'
import { PublicFooter } from '@/components/ui/public-footer'
import CustomerAccount from './customer-account'

export const dynamic = 'force-dynamic'

export default async function CustomerAccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [session, query] = await Promise.all([auth(), searchParams])
  const customer = (session as any)?.role === 'CUSTOMER'
  return (
    <div className="themed-static-bg min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-8 sm:py-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent-hover)]">BookEasy pentru tine</p>
        <h1 className="text-3xl font-semibold tracking-tight">Contul meu</h1>
        <p className="mt-2 mb-6 text-sm text-gray-600">Conectează-te cu Google sau creează un cont cu email și parolă.</p>
        <CustomerAccount
          email={customer ? session?.user?.email ?? null : null}
          name={customer ? session?.user?.name ?? null : null}
          googleAccount={customer && Boolean((session as any)?.googleSub)}
          businessSession={Boolean(session && !customer)}
          googleAvailable={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
          oauthError={Boolean(query.error)}
        />
      </main>
      <PublicFooter />
    </div>
  )
}
