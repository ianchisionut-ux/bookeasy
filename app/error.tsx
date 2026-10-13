'use client'
import ClientPageLinks from '@/components/client-page-links'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="themed-static-bg flex min-h-svh items-center justify-center p-5"><div className="card w-full max-w-xl p-7 text-center"><h1 className="text-2xl font-semibold">Pagina nu s-a putut încărca</h1><p className="mb-5 mt-3 text-sm text-[var(--foreground-muted)]">Încearcă din nou sau revino la pagina principală.</p><button type="button" onClick={reset} className="btn-primary mb-5 min-h-11">Încearcă din nou</button><ClientPageLinks /></div></main>
}
