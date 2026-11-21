import Link from 'next/link'
import Image from 'next/image'
import { company, consumerAuthorities } from '@/lib/company'
import { CookiePreferencesButton } from '@/components/cookie-preferences-button'
import { IntegrationsMarquee } from '@/components/ui/integrations-marquee'

export function PublicFooter() {
  return <>
    <IntegrationsMarquee />
    <footer className="border-t border-[var(--border-soft)] bg-[var(--brand-ink)] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-5 border-b border-white/10 pb-5 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="max-w-sm text-sm leading-relaxed text-white/65">Platformă SaaS pentru programări, clienți, echipe și comunicare automată.</p>
          {process.env.GOOGLE_PLAY_LISTING_AVAILABLE === 'true' && (
            <a href="https://play.google.com/store/apps/details?id=ro.bookeasy.app" className="mt-3 inline-flex max-w-full rounded-md">
              <Image
                src="/google-play-badge-ro.png"
                alt="Descarcă BookEasy de pe Google Play"
                width={646}
                height={250}
                className="h-auto w-40 max-w-full"
              />
            </a>
          )}
          <p className="mt-2 text-xs text-white/50">{company.legalName} · CUI {company.cui}<br />{company.tradeRegistryNumber}</p>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-green)]">Legal</h2>
          <nav className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-white/70 md:grid-cols-1" aria-label="Documente legale">
            <Link href="/contact" className="hover:text-white">Contact și suport</Link>
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
          <p className="mt-2 text-xs leading-relaxed text-white/65">Consumatorii pot sesiza ANPC sau pot consulta procedura de soluționare alternativă a litigiilor (SAL).</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <a href={consumerAuthorities.anpc} target="_blank" rel="nofollow noopener noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-white/80 hover:border-white/35 hover:text-white">ANPC</a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-center gap-3">
        <a
          href={consumerAuthorities.sal}
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Soluționarea Alternativă a Litigiilor prin ANPC"
          className="block rounded-xl bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Image
            src="/legal/anpc-sal-250x50.png"
            alt="Soluționarea Alternativă a Litigiilor"
            width={250}
            height={50}
            className="h-[50px] w-[250px]"
            unoptimized
          />
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
  </>
}
