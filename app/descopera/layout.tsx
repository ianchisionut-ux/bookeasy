import type { Metadata } from 'next'
import { publicMetadata, SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  ...publicMetadata('Descoperă și rezervă online', SITE_DESCRIPTION, '/descopera'),
  manifest: '/bookeasy-client.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy Client' },
}

export default function ClientMarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children
}
