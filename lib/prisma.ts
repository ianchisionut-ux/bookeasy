import { PrismaClient } from '@prisma/client/wasm'
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
  let context: object
  try {
    context = getCloudflareContext().ctx
  } catch {
    // Next.js build / local Node server, outside the Workers runtime.
    return localClient ??= createPrismaClient()
  }
  let client = requestClients.get(context)
  if (!client) {
    client = createPrismaClient()
    requestClients.set(context, client)
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
