import type { Metadata } from 'next'

export const metadata: Metadata = {
  manifest: '/bookeasy-client.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy Client' },
}

export default function MarketplaceMapLayout({ children }: { children: React.ReactNode }) {
  return children
}
