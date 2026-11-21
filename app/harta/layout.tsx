import type { Metadata } from 'next'
import { publicMetadata } from '@/lib/seo'

export const metadata: Metadata = {
  ...publicMetadata('Harta serviciilor cu rezervari online | BookEasy', 'Gaseste saloane, clinici si alte servicii din apropiere. Vezi locatia pe harta si verifica disponibilitatea pentru o programare online.', '/harta'),
  manifest: '/bookeasy-client.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy Client' },
}

export default function MarketplaceMapLayout({ children }: { children: React.ReactNode }) {
  return children
}
