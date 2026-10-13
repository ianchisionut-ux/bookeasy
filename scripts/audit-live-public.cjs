// Safe read-only checks. No account creation, booking submission, emails or payments.
const fs = require('node:fs/promises')
const base = process.argv[2] || 'https://www.bookeasy.ro'
const cases = [
  ['/descopera', [200]], ['/harta', [200]], ['/pentru-afaceri', [200]], ['/cont', [200]], ['/login', [200]], ['/signup', [200]], ['/forgot-password', [200]], ['/reset-password', [200]], ['/offline', [200]],
  ['/legal', [200]], ['/legal/termeni', [200]], ['/legal/confidentialitate', [200]], ['/legal/cookies', [200]], ['/dpa', [200]], ['/pagina-audit-inexistenta', [404]],
  ['/robots.txt', [200]], ['/sitemap.xml', [200]], ['/bookeasy-client.webmanifest', [200]], ['/sw.js', [200]],
  ['/dashboard/setari', [307, 302]], ['/superadmin', [307, 302]], ['/api/business/bookings', [401]], ['/api/business/conversations', [401]], ['/api/business/notification-counts', [401]], ['/api/superadmin/integration-health', [401, 403]],
  ['/api/public/availability', [400]], ['/api/public/practitioners', [400]], ['/api/public/reviews?slug=audit', [401]], ['/api/cron/check-tokens', [401]], ['/api/cron/billing', [401]], ['/api/cron/billing-payments', [401]], ['/api/cron/reminders', [401]], ['/api/oauth/instagram/start', [307, 302]],
]
async function main() {
  const results = []
  for (let offset = 0; offset < cases.length; offset += 4) {
    results.push(...await Promise.all(cases.slice(offset, offset + 4).map(async ([path, expected]) => {
      const started = Date.now()
      try {
        const response = await fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
        const html = response.headers.get('content-type')?.includes('text/html') ? await response.text() : ''
        const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1] ?? null
        return { path, status: response.status, ok: expected.includes(response.status), ms: Date.now() - started, canonical, noindex: response.headers.get('x-robots-tag')?.includes('noindex') ?? false, recoveryLinks: /<nav[^>]*aria-label="Continuă navigarea"/.test(html), redirectedTo: response.headers.get('location') }
      } catch (error) { return { path, ok: false, error: error.message } }
    })))
  }
  await fs.writeFile(process.argv[3] || 'output/live-public-audit.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), results }, null, 2))
  console.log(JSON.stringify({ checked: results.length, passed: results.filter((r) => r.ok).length, failures: results.filter((r) => !r.ok), seo: results.filter((r) => ['/descopera', '/harta', '/pentru-afaceri', '/cont'].includes(r.path)) }, null, 2))
  if (results.some((r) => !r.ok)) process.exitCode = 1
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
