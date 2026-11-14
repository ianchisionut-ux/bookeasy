// Retired distribution URLs must never serve executable packages again.
export function GET() {
  return new Response('Această descărcare nu mai este disponibilă.', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
