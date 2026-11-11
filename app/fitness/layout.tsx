import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Fitness · programul tău', manifest: '/bookeasy-fitness.webmanifest', robots: { index: false, follow: false } }
export default function FitnessLayout({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[var(--surface-muted)]">{children}</div> }
