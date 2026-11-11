import SignupForm from './signup-form'
import {getPlanPrices} from '@/lib/plan-pricing'

export const dynamic = 'force-dynamic'
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ promo?: string | string[] }> }) {
  const query = await searchParams
  const promo = typeof query.promo === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(query.promo)
    ? query.promo.toUpperCase()
    : undefined
  const prices=await getPlanPrices()
  return <SignupForm prices={prices} key={promo ?? 'manual'} launchOpen lockedPromoCode={promo} />
}
