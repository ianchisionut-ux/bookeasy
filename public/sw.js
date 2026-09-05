const VERSION = 'bookeasy-pwa-v2'
const STATIC_CACHE = `${VERSION}-static`
const STATIC_ASSETS = [
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo-mark-square.png',
  '/logo.png',
]

// Network failures include DNS/server failures, not only loss of Internet.
// Keep this document independent of Next.js chunks and route hydration.
function unavailablePage() {
  return new Response(`<!doctype html><html lang="ro"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BookEasy — Conectare întreruptă</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f7;color:#17162e;font:16px system-ui}main{max-width:420px;margin:24px;padding:32px;border-radius:20px;background:white;text-align:center}h1{font-size:22px}p{line-height:1.6;color:#626474}button{border:0;border-radius:24px;padding:14px 24px;background:#17162e;color:white;font:inherit;cursor:pointer}</style>
<main><h1>Nu putem contacta BookEasy momentan</h1><p>Conexiunea sau serverul este temporar indisponibil. Programările și datele clienților nu sunt păstrate offline.</p><button onclick="location.reload()">Încearcă din nou</button></main></html>`, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('bookeasy-pwa-') && key !== STATIC_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Datele autentificate, API-urile și documentele medicale nu ajung niciodată în cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard/') || url.pathname.startsWith('/superadmin/') || url.pathname.includes('/documents/')) {
    if (request.mode === 'navigate') event.respondWith(fetch(request).catch(unavailablePage))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(unavailablePage))
    return
  }

  // Let Next.js and the browser manage versioned bundles; do not duplicate them
  // in a long-lived PWA cache shared across deployments.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})
