import VerificationForm from './verification-form'

export const metadata = { title: 'Confirmă emailul | Bookeasy', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string; delivery?: string }> }) {
  const query = await searchParams
  return <VerificationForm token={query.token ?? ''} initialEmail={query.email ?? ''} deliveryFailed={query.delivery === 'failed'} />
}
