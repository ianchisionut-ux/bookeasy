const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../lib/prisma.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const connections = []
let context
class PrismaNeon {
  constructor(options) { this.connectionString = options.connectionString }
}
class PrismaClient {
  constructor(options) { connections.push(options.adapter.connectionString) }
  $extends() { return this }
  get business() { return this }
}
const mocks = {
  '@prisma/client': { PrismaClient },
  '@prisma/adapter-neon': { PrismaNeon },
  '@opennextjs/cloudflare': { getCloudflareContext: () => {
    if (!context) throw new Error('No Worker context')
    return context
  } },
  './database-read-retry': { retryDatabaseRead: (_operation, callback) => callback() },
}
const loadedModule = { exports: {} }
new Function('require', 'module', 'exports', code)(
  name => name in mocks ? mocks[name] : require(name), loadedModule, loadedModule.exports,
)
const { prisma } = loadedModule.exports
const previous = process.env.DATABASE_URL
try {
  const productionUrl = 'postgresql://test:test@localhost:5432/production'
  const previewUrl = 'postgresql://test:test@localhost:5432/preview'
  process.env.DATABASE_URL = productionUrl
  context = { env: { BOOKEASY_CLOUDFLARE_PREVIEW: 'true', DATABASE_URL: productionUrl }, ctx: {} }
  assert.throws(() => prisma.business, /BOOKEASY_PREVIEW_DATABASE_URL/)
  context = { env: { ...context.env, BOOKEASY_PREVIEW_DATABASE_URL: productionUrl }, ctx: {} }
  assert.throws(() => prisma.business, /BOOKEASY_PREVIEW_DATABASE_URL/)
  assert.deepEqual(connections, [])
  context = { env: { ...context.env, BOOKEASY_PREVIEW_DATABASE_URL: previewUrl }, ctx: {} }
  assert.equal(prisma.business, prisma.business)
  assert.deepEqual(connections, [previewUrl])
  context = { env: { BOOKEASY_CLOUDFLARE_PREVIEW: 'false', DATABASE_URL: productionUrl }, ctx: {} }
  void prisma.business
  assert.deepEqual(connections, [previewUrl, productionUrl])
  console.log('PASS Preview rejects missing or production DB and uses its dedicated secret')
} finally {
  if (previous === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = previous
}
