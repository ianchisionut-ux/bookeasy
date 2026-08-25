import './globals.css'
import { Manrope } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import PwaManager from '@/components/pwa-manager'

const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: 'bookeasy.ro',
  description: 'Platformă pentru programări și rezervări, într-un singur calendar.',
  manifest: '/manifest.webmanifest',
  applicationName: 'BookEasy',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BookEasy' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}
export const viewport: Viewport = {
  themeColor: '#11112b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}



export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={manrope.variable}>
      <body>
        {children}
        <PwaManager />
      </body>
    </html>
  )
}
