import { auth } from '@/lib/auth'
import { getClientProfile } from '@/lib/client-profile'
import FitnessActivation from './fitness-activation'

export const dynamic = 'force-dynamic'
export default async function ActivationPage() {
  const session = await auth()
  const customer = (session as any)?.role === 'CUSTOMER'
  return <FitnessActivation authenticated={customer} loginProps={{ email: customer ? session?.user?.email ?? null : null, name: session?.user?.name ?? null, googleAccount: Boolean((session as any)?.googleSub), businessSession: Boolean(session && !customer), googleAvailable: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), oauthError: false, profile: await getClientProfile(session) }} />
}
