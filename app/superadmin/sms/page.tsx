import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SmsGatewaySettings from '@/components/sms-gateway-settings'
export const dynamic = 'force-dynamic'
export default async function SmsPage() {
  const session = await auth() as any
  if (!session?.isSuperAdmin) redirect('/dashboard')
  const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' } })
  return <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-semibold">SMS</h1><p className="mt-2 text-sm text-gray-600">Un singur telefon Android și un singur SIM trimit SMS-urile tuturor afacerilor. Configurează numărul și asociază telefonul doar aici.</p></div>
    <SmsGatewaySettings central initial={{ apiUrl: null, hasApiKey: false, deviceId: null, phone: gateway?.phone ?? null, enabled: gateway?.enabled ?? false, testedAt: null, lastError: gateway?.lastError ?? null, mode: 'BOOKEASY', paired: Boolean(gateway?.tokenHash), lastSeenAt: gateway?.lastSeenAt?.toISOString() ?? null }} /></main>
}
