import SignupForm from './signup-form'

export const dynamic = 'force-dynamic'
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ promo?: string | string[] }> }) {
  const query = await searchParams
  const promo = typeof query.promo === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(query.promo)
    ? query.promo.toUpperCase()
    : undefined
  return <SignupForm key={promo ?? 'manual'} launchOpen lockedPromoCode={promo} />
}
