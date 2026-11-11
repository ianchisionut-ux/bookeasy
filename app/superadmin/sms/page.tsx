import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SmsGatewaySettings from '@/components/sms-gateway-settings'
import { Download } from 'lucide-react'
export const dynamic = 'force-dynamic'
export default async function SmsPage() {
  const session = await auth() as any
  if (!session?.isSuperAdmin) redirect('/dashboard')
  const gateway = await prisma.platformSmsGateway.findUnique({ where: { id: 'central' } })
  return <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6"><div><h1 className="text-2xl font-semibold">SMS</h1><p className="mt-2 text-sm text-gray-600">Un singur telefon Android și un singur SIM trimit SMS-urile tuturor afacerilor. Configurează numărul și asociază telefonul doar aici.</p></div>
    <section className="card p-5 text-center" aria-labelledby="gateway-download">
      <h2 id="gateway-download" className="text-lg font-semibold">Aplicația SMS Gateway</h2>
      <p className="mt-2 text-sm text-gray-600">Instalează aplicația dedicată pe telefonul Android cu SIM-ul pentru SMS. Android 8 sau mai nou · versiunea 1.1.</p>
      <div className="public-flow-actions mt-4"><a href="/downloads/bookeasy-sms-gateway.apk" download className="btn-primary gap-2"><Download size={18} aria-hidden="true" />Descarcă SMS Gateway APK</a></div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">Deschide APK-ul pe telefon, permite instalarea din browser dacă ți se cere, apoi acordă permisiunile aplicației. Generează codul de asociere de mai jos și selectează SIM-ul configurat.</p>
    </section>
    <SmsGatewaySettings central initial={{ apiUrl: null, hasApiKey: false, deviceId: null, phone: gateway?.phone ?? null, enabled: gateway?.enabled ?? false, testedAt: null, lastError: gateway?.lastError ?? null, mode: 'BOOKEASY', paired: Boolean(gateway?.tokenHash), lastSeenAt: gateway?.lastSeenAt?.toISOString() ?? null }} /></main>
}
