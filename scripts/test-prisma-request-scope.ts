import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'

async function main() {
  const symbol = Symbol.for('__cloudflare-context__')
  const state = globalThis as unknown as Record<symbol, unknown>
  const previous = state[symbol]
  let firstDisconnect: (() => Promise<void>) | undefined
  let secondDisconnect: (() => Promise<void>) | undefined
  try {
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
    console.log('PASS: request isolation and client reuse')
  } finally {
    state[symbol] = previous
    await firstDisconnect?.()
    await secondDisconnect?.()
  }
}
main().catch(error => { console.error('FAIL:', String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[database]')); process.exitCode = 1 })
