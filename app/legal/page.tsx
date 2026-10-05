import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Cookie, FileCheck2, FileText, LockKeyhole, Scale, ShieldCheck } from 'lucide-react'
import { PublicHeader } from '@/components/ui/public-header'
import { PublicFooter } from '@/components/ui/public-footer'
import { company } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Informații legale | BookEasy',
  description: 'Datele operatorului și documentele juridice aplicabile platformei BookEasy.',
}

const documents = [
  { href: '/legal/termeni', icon: FileText, title: 'Termeni și condiții', description: 'Condițiile de utilizare a platformei BookEasy și regulile abonamentelor SaaS.' },
  { href: '/legal/confidentialitate', icon: LockKeyhole, title: 'Politică de confidențialitate', description: 'Cum prelucrăm și protejăm datele, conform GDPR.' },
  { href: '/legal/cookies', icon: Cookie, title: 'Politică de cookie-uri', description: 'Cookie-uri, stocare locală și gestionarea preferințelor.' },
  { href: '/dpa', icon: FileCheck2, title: 'DPA - Acord de prelucrare a datelor', description: 'Acordul conform Art. 28 GDPR, inclusiv versiunea PDF descărcabilă.' },
]

export default function LegalHubPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-muted)]">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-green-dark)]">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[var(--brand-ink)] sm:text-4xl">Informații legale</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">Datele de identificare ale operatorului BookEasy și documentele care reglementează utilizarea platformei.</p>
        </div>
        <section className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-white shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--brand-teal-soft)] px-5 py-4 sm:px-7">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-teal)] text-white"><Building2 size={19} /></span>
            <div><h2 className="font-semibold">Date de identificare</h2><p className="text-xs text-gray-500">Operatorul platformei BookEasy</p></div>
          </div>
          <dl className="grid gap-0 px-5 py-2 text-sm sm:px-7">
            {[
              ['Denumire', company.legalName], ['CUI', company.cui], ['Nr. Registrul Comerțului', company.tradeRegistryNumber],
              ['Sediu social', company.registeredAddress], ['Activitate principală', `${company.mainActivity} (CAEN ${company.caen})`],
              ['Contact legal și GDPR', company.legalEmail],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 border-b border-[var(--border-soft)] py-3 last:border-0 sm:grid-cols-[190px_1fr]">
                <dt className="text-xs font-bold uppercase tracking-[0.06em] text-gray-400">{label}</dt><dd className="font-medium text-[var(--brand-ink)]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Documente legale</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {documents.map(({ href, icon: Icon, title, description }) => (
              <Link key={href} href={href} className="group rounded-[22px] border border-[var(--border-soft)] bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--brand-teal)] hover:shadow-[var(--shadow-card-hover)]">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-green-soft)] text-[var(--brand-green-dark)]"><Icon size={20} /></span>
                <h3 className="mt-4 font-semibold text-[var(--brand-ink)] group-hover:text-[var(--brand-teal-dark)]">{title}</h3><p className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</p>
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-10 rounded-[22px] bg-[var(--brand-ink)] p-6 text-white sm:p-8">
          <div className="flex items-start gap-3"><Scale className="mt-0.5 text-[var(--brand-green)]" size={22} /><div><h2 className="text-lg font-semibold">Drepturile consumatorilor</h2><p className="mt-2 text-sm leading-relaxed text-white/65">Dacă ești consumator și ai o reclamație nesoluționată, poți sesiza Autoritatea Națională pentru Protecția Consumatorilor sau platforma europeană SOL.</p><div className="mt-4 flex flex-wrap gap-3"><a href="https://anpc.ro/" target="_blank" rel="nofollow noopener noreferrer" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[var(--brand-ink)]">ANPC - anpc.ro</a><a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="nofollow noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold">Platforma SOL</a></div></div></div>
        </section>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-gray-400"><ShieldCheck size={14} /> Documente actualizate la 5 octombrie 2026.</p>
      </main>
      <PublicFooter />
    </div>
  )
}
