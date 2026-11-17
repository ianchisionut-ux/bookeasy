import type { Metadata } from 'next'
import { publicMetadata } from '@/lib/seo'

export const metadata: Metadata = {
  ...publicMetadata('Afaceri pe hartă', 'Găsește saloane, clinici și alte afaceri din apropiere pe hartă și rezervă online prin BookEasy.', '/harta'),
  manifest: '/bookeasy-client.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy Client' },
}

export default function MarketplaceMapLayout({ children }: { children: React.ReactNode }) {
  return children
}
