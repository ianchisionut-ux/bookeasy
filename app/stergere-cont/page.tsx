import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicHeader } from '@/components/ui/public-header'
import { company } from '@/lib/company'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AccountDeletionCard from '@/components/account-deletion-card'

export const metadata: Metadata = { title: 'Ștergerea contului BookEasy', description: 'Solicită ștergerea contului personal BookEasy și a datelor asociate, inclusiv fără aplicația instalată.' }

export const dynamic = 'force-dynamic'
export default async function AccountDeletionPage() {
  const session = await auth()
  const details = session as any
  const business = details?.role === 'OWNER' && !details.isSuperAdmin && !details.isImpersonatingBusiness && details.businessId
    ? await prisma.business.findUnique({ where: { id: details.businessId }, select: { name: true } }) : null
  return <div className="themed-static-bg min-h-screen"><PublicHeader /><main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
    <section className="card p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-hover)]">BookEasy · Contul personal</p><h1 className="mt-3 text-2xl font-semibold">Solicită ștergerea contului și a datelor</h1>
      <p className="mt-4 text-sm leading-relaxed text-gray-600">Îți poți șterge singur contul, fără aprobarea unui administrator și fără un email. Ștergerea se execută numai după două confirmări explicite.</p>
      {details?.role === 'CUSTOMER' && session?.user?.email && <AccountDeletionCard kind="customer" accountName={session.user.email} />}
      {business && <AccountDeletionCard kind="business" accountName={business.name} />}
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gray-700"><li>Conectează-te la contul personal BookEasy pe care dorești să îl ștergi.</li><li>În „Contul meu”, apasă „Șterge contul personal” și confirmă că ai înțeles ce se elimină.</li><li>La confirmarea finală, scrie STERGE, bifează confirmarea și apasă „Șterge definitiv”. Vei fi deconectat automat.</li></ol>
      <Link href="/cont#stergere-cont" className="btn-primary mt-7 flex min-h-12 items-center justify-center text-center">Deschide contul meu</Link>
      <h2 className="mt-7 font-semibold">Contul unei afaceri</h2><p className="mt-2 text-sm text-gray-600">Proprietarul poate șterge definitiv afacerea din Setări → Ștergerea contului. Confirmarea finală cere numele exact al afacerii. Personalul și clienții nu pot șterge afacerea.</p>
      <Link href="/dashboard/setari#stergere-cont-afacere" className="btn-secondary mt-3 flex min-h-11 items-center justify-center text-center">Deschide setările afacerii</Link>
      <p className="mt-5 text-sm text-gray-600">Dacă nu te mai poți conecta, poți cere ajutor la <a href={`mailto:${company.privacyEmail}`} className="break-all underline">{company.privacyEmail}</a>. Scrie de la adresa contului și precizează contul vizat. Nu trimite parola sau coduri de autentificare.</p>
      <h2 className="mt-8 font-semibold">Ce date sunt vizate</h2><p className="mt-2 text-sm leading-relaxed text-gray-600">Contul personal, profilul și datele asociate acestuia sunt incluse în solicitare. Ștergerea contului BookEasy nu șterge contul tău Google și nu reprezintă automat anularea programărilor făcute la afaceri.</p>
      <h2 className="mt-6 font-semibold">Date care pot necesita păstrare</h2><p className="mt-2 text-sm leading-relaxed text-gray-600">Anumite evidențe pot fi păstrate pentru obligații legale, securitate, prevenirea fraudei sau soluționarea disputelor, numai cât este necesar scopului respectiv. Datele gestionate de o afacere, inclusiv documentele medicale ori financiar-contabile, se tratează potrivit obligațiilor acelei afaceri. Copiile de siguranță sunt eliminate în ciclul lor de retenție. Îți explicăm eventualele excepții în răspunsul la solicitare.</p>
      <p className="mt-6 text-sm text-gray-600">Detalii în <Link href="/legal/confidentialitate" className="underline">Politica de confidențialitate</Link>.</p>
    </section>
  </main></div>
}
