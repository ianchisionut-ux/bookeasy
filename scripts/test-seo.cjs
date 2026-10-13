const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)((name) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}
async function main() {
  const seo = load('lib/seo.ts')
  const maliciousName = '</script><script>alert(1)</script>'
  const encoded = seo.jsonLd({ name: maliciousName })
  assert.equal(encoded.includes('</script>'), false)
  assert.equal(JSON.parse(encoded).name, maliciousName)
  assert.equal(seo.publicMetadata('Test', 'Description', '/test').alternates.canonical, 'https://www.bookeasy.ro/test')
  let query
  const sitemap = load('app/sitemap.ts', {
    '@/lib/seo': seo, '@/lib/business-categories': { PUBLIC_CATEGORIES: ['SALON', 'CLINICA'] },
    '@/lib/prisma': { prisma: { business: { findMany: async (args) => { query = args; return [{ slug: 'salon-public' }] } } } },
  })
  const entries = await sitemap.default()
  assert.equal(query.where.publicListed, true)
  assert.equal(query.where.accountActive, true)
  assert.ok(entries.some((entry) => entry.url.endsWith('/salon-public')))
  assert.equal(entries.some((entry) => /\/(cont|login|dashboard|rezerva|recenzie)$/.test(entry.url)), false)
  const headers = await require('../next.config.js').headers()
  for (const path of ['/cont', '/login', '/api/:path*', '/dashboard/:path*', '/:slug/rezerva', '/:slug/recenzie', '/reset-password']) {
    assert.ok(headers.some((rule) => rule.source === path && rule.headers.some((header) => header.key === 'X-Robots-Tag' && header.value === 'noindex')))
  }
  assert.equal(headers.some((rule) => rule.source === '/descopera' && rule.headers.some((header) => header.key === 'X-Robots-Tag')), false)
  console.log('SEO passed: JSON-LD escapes script injection, canonical URLs, public/active-only sitemap and private/action-route noindex.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
