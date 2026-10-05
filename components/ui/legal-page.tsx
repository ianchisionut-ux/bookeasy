import type { ReactNode } from 'react'
import Link from 'next/link'
import { PublicFooter } from './public-footer'
import { PublicHeader } from './public-header'

export function LegalPage({
  title,
  updatedAt,
  version = '1.0',
  eyebrow = 'DOCUMENT LEGAL',
  description,
  children,
}: {
  title: string
  updatedAt: string
  version?: string
  eyebrow?: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-muted)]">
      <PublicHeader />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-14">
        <article className="legal-document mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-white shadow-[var(--shadow-card)]">
          <header className="legal-document-header px-5 py-8 sm:px-10 sm:py-11">
            <Link href="/legal" className="mb-6 inline-flex text-xs font-semibold text-[var(--brand-teal-dark)] hover:underline">← Informații legale</Link>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-green-dark)]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[var(--brand-ink)] sm:text-4xl">{title}</h1>
            {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">{description}</p>}
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5">Versiunea {version}</span>
              <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5">Actualizat {updatedAt}</span>
            </div>
          </header>
          <div className="legal-content px-5 py-7 sm:px-10 sm:py-10">{children}</div>
        </article>
      </main>
      <PublicFooter />
    </div>
  )
}
