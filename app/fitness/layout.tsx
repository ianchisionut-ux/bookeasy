import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'FitEasy · Client', applicationName: 'FitEasy Client', manifest: '/api/fitness/manifest?role=client',
  robots: { index: false, follow: false }, referrer: 'no-referrer',
  appleWebApp: { capable: true, title: 'FitEasy Client', statusBarStyle: 'default' },
  icons: { icon: '/api/fitness/icon', apple: '/api/fitness/icon' },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <main data-brand="fiteasy" className="min-h-screen bg-[var(--surface-muted)]">
    <header className="border-b bg-white px-5 py-2"><a href="/fitness"><img src="/fiteasy-logo.png" alt="FitEasy.ro" width="170" height="80" className="h-16 w-auto" /></a></header>
    {children}
  </main>
}
