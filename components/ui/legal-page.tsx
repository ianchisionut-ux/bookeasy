import type { ReactNode } from 'react'
import { PublicFooter } from './public-footer'
import { PublicHeader } from './public-header'

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-muted)]">
      <PublicHeader />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <article className="card mx-auto max-w-3xl px-5 py-7 sm:px-10 sm:py-10">
          <header className="mb-8 border-b border-[var(--border-soft)] pb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-gray-500">Ultima actualizare: {updatedAt}</p>
          </header>
          <div className="legal-content">{children}</div>
        </article>
      </main>
      <PublicFooter />
    </div>
  )
}
