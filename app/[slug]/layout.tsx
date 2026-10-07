import type { Metadata } from 'next'

export const metadata: Metadata = {
  manifest: '/bookeasy-client.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy Client' },
}

export default function PublicBusinessLayout({ children }: { children: React.ReactNode }) {
  return children
}
