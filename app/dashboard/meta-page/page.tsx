import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { pendingMetaPageChoices } from '@/lib/business-meta'

export default async function MetaPageSelection({ searchParams }: { searchParams: Promise<{ connection?: string; error?: string }> }) {
  const session = await auth()
  const actor = session as any
  if (!session || (!actor.isSuperAdmin && actor.role !== 'OWNER') || (!actor.isSuperAdmin && !actor.businessId)) redirect('/login')
  const query = await searchParams
  const pending = await pendingMetaPageChoices(query.connection ?? '', actor.userId, actor.isSuperAdmin ? undefined : actor.businessId)
  return <main className="mx-auto max-w-2xl p-6">
    <h1 className="text-2xl font-semibold">Alege Pagina Facebook a afacerii</h1>
    <p className="my-3 text-sm text-gray-600">Ai autorizat mai multe Pagini. Alege-o pe cea pe care vrei să o conectezi la această afacere BookEasy.</p>
    {query.error && <p role="alert" className="my-3 text-red-600">{query.error}</p>}
    {pending ? <form action="/api/oauth/meta/select-page" method="post" className="space-y-3">
      <input type="hidden" name="connection" value={pending.id} />
      {pending.pages.map(page => <label key={page.id} className={`flex items-center gap-3 rounded-xl border bg-white p-4 ${page.available ? '' : 'opacity-50'}`}>
        <input type="radio" name="page" value={page.id} required disabled={!page.available} />
        <span><strong>{page.name}</strong><small className="block text-gray-500">ID Pagină: {page.id}</small>
          {page.instagram && <small className="block text-gray-500">Instagram: @{page.instagram}</small>}
          {!page.available && <small className="block text-gray-500">Această Pagină nu are asociat un cont Instagram profesional.</small>}
        </span>
      </label>)}
      <button className="min-h-11 rounded-full bg-[var(--brand-teal)] px-6 py-3 text-white" type="submit">Conectează Pagina aleasă</button>
    </form> : <p>Alegerea a expirat sau conectarea este deja în curs. Revino în Setări pentru a verifica rezultatul ori pentru a relua conectarea.</p>}
    <Link className="mt-5 inline-block min-h-11 py-3 underline" href={pending?.redirectTo ?? '/dashboard/setari'}>Înapoi la integrări</Link>
  </main>
}
