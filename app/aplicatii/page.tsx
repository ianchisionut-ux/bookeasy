import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, Smartphone } from 'lucide-react'
import { PublicHeader } from '@/components/ui/public-header'

export const metadata: Metadata = { title: 'Aplicații BookEasy', description: 'Descarcă aplicația BookEasy pentru Android și gestionează programările de pe telefon.', alternates: { canonical: 'https://www.bookeasy.ro/aplicatii' } }

export default function ApplicationsPage() {
  return <div className="themed-static-bg min-h-screen">
    <PublicHeader />
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto mb-8 max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-teal-dark)]">BookEasy, la îndemână</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">BookEasy pe telefonul tău</h1><p className="mt-4 text-sm leading-relaxed text-gray-600">Descoperă afaceri, rezervă servicii și accesează programările tale dintr-un singur loc.</p></div>
      <div className="mx-auto grid max-w-lg gap-6">
        <section aria-labelledby="client-app" className="card flex h-full flex-col p-6 sm:p-8">
          <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Smartphone size={26} aria-hidden="true" /></span>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">Pentru utilizatorii BookEasy</p>
          <h2 id="client-app" className="mt-2 text-2xl font-semibold">BookEasy</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">Descoperă afaceri, fă programări și accesează contul tău direct de pe telefon.</p>
          <p className="mb-6 mt-4 text-xs text-gray-500">Android 8 sau mai nou · versiunea 1.2 · aproximativ 3,3 MB</p>
          <a href="/downloads/bookeasy-android.apk" download className="btn-primary mt-auto inline-flex min-h-12 items-center justify-center gap-2"><Download size={18} aria-hidden="true" />Descarcă BookEasy pentru Android</a>
          <Link href="/descopera" className="mt-4 py-2 text-center text-sm font-medium text-[var(--brand-teal-dark)]">Continuă în browser</Link>
        </section>
      </div>
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-white/80 p-5 text-sm leading-relaxed text-gray-600"><p><strong className="text-[var(--brand-ink)]">Instalare pe Android:</strong> descarcă fișierul APK, deschide-l și permite instalarea din browser dacă telefonul îți cere acest lucru.</p></div>
    </main>
  </div>
}
