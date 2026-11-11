import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { GoogleLocation } from '@/lib/google-business-locations'

export default async function GoogleLocationPage({ searchParams }: { searchParams: Promise<{ connection?: string; error?: string }> }) {
  const session = await auth()
  if (!session || (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER')) redirect('/login')
  const query = await searchParams
  const pending = await prisma.pendingGoogleConnection.findFirst({ where: { id: query.connection ?? '', userId: (session as any).userId, ...(!(session as any).isSuperAdmin ? { businessId: (session as any).businessId } : {}), expiresAt: { gt: new Date() } }, select: { id: true, locations: true, redirectTo: true } })
  return <main className="mx-auto max-w-2xl p-6">
    <h1 className="text-2xl font-semibold">Alege locația Google a afacerii</h1>
    <p className="my-3 text-sm text-gray-600">Recenziile vor fi sincronizate pentru locația pe care o selectezi.</p>
    {query.error && <p role="alert" className="my-3 text-red-600">{query.error}</p>}
    {pending ? <form action="/api/oauth/google/select-location" method="post" className="space-y-3">
      <input type="hidden" name="connection" value={pending.id} />
      {(pending.locations as unknown as GoogleLocation[]).map(location => <label key={location.id} className="flex gap-3 rounded-xl border bg-white p-4">
        <input type="radio" name="location" value={location.id} required />
        <span><strong>{location.title}</strong><small className="block text-gray-500">{location.account}</small></span>
      </label>)}
      <button className="min-h-11 rounded-full bg-[var(--brand-teal)] px-6 py-3 text-white" type="submit">Conectează locația aleasă</button>
    </form> : <p>Alegerea a expirat. Reia conectarea din Setări.</p>}
    <Link className="mt-5 inline-block min-h-11 py-3 underline" href={pending?.redirectTo ?? '/dashboard/setari'}>Înapoi la integrări</Link>
  </main>
}
