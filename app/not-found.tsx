import { PublicHeader } from '@/components/ui/public-header'
import ClientPageLinks from '@/components/client-page-links'

export default function NotFound() {
  return <div className="themed-static-bg min-h-svh"><PublicHeader /><main className="mx-auto max-w-xl px-5 py-16 text-center"><p className="mb-2 text-sm font-semibold text-[var(--accent-hover)]">404</p><h1 className="text-3xl font-semibold">Pagina nu este disponibilă</h1><p className="mb-7 mt-3 text-sm text-[var(--foreground-muted)]">Adresa poate fi greșită sau afacerea nu mai este disponibilă. Poți descoperi alte afaceri sau reveni în contul tău.</p><ClientPageLinks /></main></div>
}
