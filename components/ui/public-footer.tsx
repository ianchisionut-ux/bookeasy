import Link from 'next/link'
import Image from 'next/image'
import { company } from '@/lib/company'
import { CookiePreferencesButton } from '@/components/cookie-preferences-button'

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border-soft)] bg-[var(--brand-ink)] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-5 border-b border-white/10 pb-5 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="max-w-sm text-sm leading-relaxed text-white/65">Platformă SaaS pentru programări, clienți, echipe și comunicare automată.</p>
          <nav aria-label="Navigare site" className="mt-3 flex flex-wrap gap-x-4 gap-y-3 text-sm text-white/80">
            <Link href="/descopera" className="hover:text-white">Acasă</Link>
            <Link href="/harta" className="hover:text-white">Hartă</Link>
            <Link href="/cont" className="hover:text-white">Contul meu</Link>
            <Link href="/pentru-afaceri" className="hover:text-white">Pentru afaceri</Link>
          </nav>
          <p className="mt-2 text-xs text-white/50">{company.legalName} · CUI {company.cui}<br />{company.tradeRegistryNumber}</p>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-green)]">Legal</h2>
          <nav className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-white/70 md:grid-cols-1" aria-label="Documente legale">
            <Link href="/legal/termeni" className="hover:text-white">Termeni și condiții</Link>
            <Link href="/legal/confidentialitate" className="hover:text-white">Confidențialitate</Link>
            <Link href="/legal/cookies" className="hover:text-white">Politica de cookie-uri</Link>
            <CookiePreferencesButton className="text-left hover:text-white" />
            <Link href="/dpa" className="hover:text-white">DPA - Art. 28 GDPR</Link>
            <Link href="/legal" className="hover:text-white">Informații legale</Link>
          </nav>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-green)]">Drepturi consumatori</h2>
          <p className="mt-2 text-xs leading-relaxed text-white/65">Pentru reclamații nesoluționate poți apela la ANPC. Informații despre soluționarea litigiilor în UE sunt disponibile pe portalul Comisiei Europene.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <a href="https://anpc.ro/" target="_blank" rel="nofollow noopener noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-white/80 hover:border-white/35 hover:text-white">ANPC</a>
            <a href="https://consumer-redress.ec.europa.eu/index_ro" target="_blank" rel="nofollow noopener noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-white/80 hover:border-white/35 hover:text-white">Soluționarea litigiilor în UE</a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-center gap-3">
        <a
          href="https://anpc.ro/ce-este-sal/"
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Soluționarea Alternativă a Litigiilor prin ANPC"
          className="rounded-xl bg-white p-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <Image
            src="/legal/anpc-sal.png"
            alt="Soluționarea Alternativă a Litigiilor"
            width={500}
            height={124}
            className="h-auto w-[155px]"
          />
        </a>
        <a
          href="https://consumer-redress.ec.europa.eu/index_ro"
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Informații UE despre soluționarea litigiilor"
          className="rounded-xl bg-white p-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="block px-3 py-2 text-xs font-semibold text-[var(--brand-ink)]">Drepturile consumatorilor în UE</span>
        </a>
      </div>
      <div className="mx-auto mt-4 flex max-w-6xl flex-col items-center justify-between gap-2 text-center text-xs text-white/45 sm:flex-row sm:text-left">
        <p>
          © {new Date().getFullYear()} BookEasy · {company.legalName} · CUI {company.cui} ·{' '}
          <a
            href="https://www.nextlevel-agency.ro"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            Created by Nextlevel
          </a>
        </p>
        <nav aria-label="Informații juridice" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a href={`mailto:${company.legalEmail}`} className="transition hover:text-white">{company.legalEmail}</a>
          <Link href="/legal" className="transition hover:text-white">Documente legale</Link>
        </nav>
      </div>
    </footer>
  )
}
