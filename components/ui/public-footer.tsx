import Image from 'next/image'
import Link from 'next/link'
import { company } from '@/lib/company'

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border-soft)] bg-white px-4 py-6 sm:px-6">
      <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-center gap-4 border-b border-[var(--border-soft)] pb-6">
        <a
          href="https://anpc.ro/ce-este-sal/"
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Soluționarea Alternativă a Litigiilor prin ANPC"
          className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <Image
            src="/legal/anpc-sal.png"
            alt="Soluționarea Alternativă a Litigiilor"
            width={500}
            height={124}
            className="h-auto w-[210px]"
          />
        </a>
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="nofollow noopener noreferrer"
          aria-label="Soluționarea Online a Litigiilor"
          className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <Image
            src="/legal/anpc-sol.png"
            alt="Soluționarea Online a Litigiilor"
            width={500}
            height={124}
            className="h-auto w-[210px]"
          />
        </a>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-center text-xs text-gray-500 sm:flex-row sm:text-left">
        <p>
          © {new Date().getFullYear()} BookEasy · {company.legalName} · CUI {company.cui} ·{' '}
          <a
            href="https://www.nextlevel-agency.ro"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-gray-900"
          >
            Created by Nextlevel
          </a>
        </p>
        <nav aria-label="Informații juridice" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/politica-de-confidentialitate" className="transition hover:text-gray-900">
            Politica de confidențialitate
          </Link>
          <Link href="/termeni-si-conditii" className="transition hover:text-gray-900">
            Termeni și condiții
          </Link>
        </nav>
      </div>
    </footer>
  )
}
