import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'BookEasy – Programări și rezervări',
    short_name: 'BookEasy',
    description: 'Gestionează programările, rezervările și clienții într-un singur loc.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#f4f8f7',
    theme_color: '#178f92',
    lang: 'ro',
    categories: ['business', 'productivity', 'medical'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo-mark-square.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Calendar', short_name: 'Calendar', url: '/dashboard/calendar', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Programări', short_name: 'Programări', url: '/dashboard/programari', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Clienți', short_name: 'Clienți', url: '/dashboard/clienti', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
