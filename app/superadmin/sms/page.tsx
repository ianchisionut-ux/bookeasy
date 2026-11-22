import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SmsGatewayActivity from '@/components/sms-gateway-activity'
import SmsApiConnectionTest from '@/components/smsapi-connection-test'
import { smsApiDailyLimit, usesSmsApi } from '@/lib/smsapi'
export const dynamic = 'force-dynamic'
export default async function SmsPage() {
  const session = await auth() as any
  if (!session?.isSuperAdmin) redirect('/dashboard')
  const automaticReconfirmation = usesSmsApi() && process.env.SMSAPI_AUTO_RECONFIRMATION === 'true'
  return <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
    <div>
      <h1 className="text-2xl font-semibold">SMS</h1>
      <p className="mt-2 text-sm text-gray-600">SMSAPI permite un singur SMS de programare per rezervare și cel mult {smsApiDailyLimit()} încercări în 24 de ore pentru toate afacerile.</p>
      <p className="mt-2 text-sm text-gray-600">Reconfirmări automate {automaticReconfirmation ? 'permise pentru afacerile care le-au activat' : 'oprite'}. Verifică expeditorul, creditul și livrările în portalul SMSAPI.</p>
    </div>
    <SmsApiConnectionTest />
    <SmsGatewayActivity />
  </main>
}
