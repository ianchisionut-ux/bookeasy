import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { getCloudflareContext } from '@opennextjs/cloudflare'

function createPrismaClient() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL ?? '',
  })

  return new PrismaClient({ adapter })
}

const requestClients = new WeakMap<object, PrismaClient>()
let localClient: PrismaClient | undefined

function currentClient() {
  let context: ReturnType<typeof getCloudflareContext>
  try {
    context = getCloudflareContext()
  } catch {
    // Next.js build / local Node server, outside the Workers runtime.
    return localClient ??= createPrismaClient()
  }
  // getCloudflareContext()'s return type resolves `ctx` as `unknown` here,
  // so cast explicitly rather than relying on inference — the object at
  // runtime is Cloudflare's ExecutionContext regardless of the TS type.
  const key = context.ctx as object
  let client = requestClients.get(key)
  if (!client) {
    client = createPrismaClient()
    requestClients.set(key, client)
    // Tie the Neon WebSocket's teardown to THIS request's lifecycle.
    // $disconnect() drains any in-flight queries on this client before
    // closing the socket, so registering it immediately is safe — but
    // without waitUntil, that teardown could otherwise run while the
    // isolate is already serving a different request, which is exactly
    // what produces "Cannot perform I/O on behalf of a different request."
    ;(key as { waitUntil(promise: Promise<unknown>): void }).waitUntil(client.$disconnect())
  }
  return client
}

// Share a client within one request, including array transactions, without
// sharing request-bound WebSocket I/O across Workers requests.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property: keyof PrismaClient) {
    const client = currentClient()
    const value = client[property]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
