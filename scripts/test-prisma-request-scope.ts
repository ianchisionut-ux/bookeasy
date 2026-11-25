import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'

async function main() {
  const symbol = Symbol.for('__cloudflare-context__')
  const state = globalThis as unknown as Record<symbol, unknown>
  const previous = state[symbol]
  const previousDatabaseUrl = process.env.DATABASE_URL
  let firstDisconnect: (() => Promise<void>) | undefined
  let secondDisconnect: (() => Promise<void>) | undefined
  let previewDisconnect: (() => Promise<void>) | undefined
  let nodeDisconnect: (() => Promise<void>) | undefined
  try {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    state[symbol] = { env: {}, ctx: {} }
    const first = prisma.business
    firstDisconnect = prisma.$disconnect
    assert.equal(first, prisma.business, 'Models in one request must share a client')
    // This checks client identity without invoking the Worker-only WASM loader.
    // Database execution is verified against the deployed Workers runtime.
    state[symbol] = { env: {}, ctx: {} }
    secondDisconnect = prisma.$disconnect
    assert.notEqual(first, prisma.business, 'Different requests must use different clients')
    assert.equal(prisma.business, prisma.business, 'Second request must also reuse its client')
    state[symbol] = { env: { BOOKEASY_CLOUDFLARE_PREVIEW: 'true', DATABASE_URL: process.env.DATABASE_URL }, ctx: {} }
    assert.throws(() => prisma.business, /BOOKEASY_PREVIEW_DATABASE_URL/, 'Preview must reject a missing dedicated database')
    state[symbol] = { env: { BOOKEASY_CLOUDFLARE_PREVIEW: 'true', DATABASE_URL: process.env.DATABASE_URL,
      BOOKEASY_PREVIEW_DATABASE_URL: process.env.DATABASE_URL }, ctx: {} }
    assert.throws(() => prisma.business, /BOOKEASY_PREVIEW_DATABASE_URL/, 'Preview must reject the production URL')
    state[symbol] = { env: { BOOKEASY_CLOUDFLARE_PREVIEW: 'true', DATABASE_URL: process.env.DATABASE_URL,
      BOOKEASY_PREVIEW_DATABASE_URL: 'postgresql://test:test@localhost:5432/preview' }, ctx: {} }
    const preview = prisma.business
    previewDisconnect = prisma.$disconnect
    assert.notEqual(preview, first, 'Preview must use a separate client')
    delete state[symbol]
    const nodeClient = prisma.business
    nodeDisconnect = prisma.$disconnect
    assert.notEqual(first, nodeClient, 'A Worker request must not reuse the Node client')
    assert.equal(nodeClient, prisma.business, 'Node must continue to reuse its own client')
    console.log('PASS: request isolation and client reuse')
  } finally {
    if (previous === undefined) delete state[symbol]
    else state[symbol] = previous
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    await firstDisconnect?.()
    await secondDisconnect?.()
    await previewDisconnect?.()
    await nodeDisconnect?.()
  }
}
main().catch(error => { console.error('FAIL:', String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[database]')); process.exitCode = 1 })
