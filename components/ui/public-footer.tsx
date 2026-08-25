import Link from 'next/link'
import { company } from '@/lib/company'

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border-soft)] bg-white px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-center text-xs text-gray-500 sm:flex-row sm:text-left">
        <p>© {new Date().getFullYear()} BookEasy · {company.legalName} · CUI {company.cui}</p>
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
