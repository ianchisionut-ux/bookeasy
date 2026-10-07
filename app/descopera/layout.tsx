import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Descoperă și rezervă | BookEasy',
  description: 'Alege o categorie sau o afacere favorită și rezervă online.',
  manifest: '/bookeasy-client.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy Client' },
}

export default function ClientMarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children
}
