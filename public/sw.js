const VERSION = 'bookeasy-pwa-v1'
const STATIC_CACHE = `${VERSION}-static`
const STATIC_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo-mark-square.png',
  '/logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('bookeasy-pwa-') && key !== STATIC_CACHE).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Datele autentificate, API-urile și documentele medicale nu ajung niciodată în cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard/') || url.pathname.startsWith('/superadmin/') || url.pathname.includes('/documents/')) {
    if (request.mode === 'navigate') event.respondWith(fetch(request).catch(() => caches.match('/offline')))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline')))
    return
  }

  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})
