'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[page-error]', { digest: error.digest ?? 'client-error' }) }, [error])
  return <main className="flex min-h-[70vh] items-center justify-center px-5 py-10">
    <section className="card w-full max-w-md p-6 text-center" role="alert">
      <h1 className="text-xl font-semibold">Nu am putut încărca pagina</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">Conexiunea cu serverul poate fi temporar indisponibilă. Încearcă din nou. Dacă tocmai ai salvat ceva, verifică rezultatul înainte să repeți acțiunea.</p>
      <div className="public-flow-actions mt-5"><button type="button" onClick={reset} className="btn-primary">Reîncearcă</button><button type="button" onClick={() => window.location.reload()} className="btn-secondary">Reîncarcă pagina</button></div>
      <Link href="/cont" className="mt-4 inline-block text-sm text-[var(--accent-hover)] underline">Mergi la contul meu</Link>
      {error.digest && <p className="mt-4 break-all text-xs text-gray-500">Cod pentru suport: {error.digest}</p>}
    </section>
  </main>
}
