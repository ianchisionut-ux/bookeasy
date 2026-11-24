import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { retryDatabaseRead } from './database-read-retry'

const globalForPrisma = globalThis as unknown as { bookeasyPrisma?: PrismaClient }
const workerClients = new WeakMap<object, PrismaClient>()

function createPrismaClient(inWorker: boolean) {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL nu este configurat.')
  const client = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString,
      connectionTimeoutMillis: 15_000,
      max: 5,
      // Close a Worker socket when the pool releases it. A transaction
      // retains its connection until commit or rollback.
      maxUses: inWorker ? 1 : undefined,
    }),
  })
  return client.$extends({
    name: 'transient-database-reads',
    query: {
      $allModels: {
        $allOperations({ operation, args, query }) {
          return retryDatabaseRead(operation, () => query(args))
        },
      },
    },
  }) as unknown as PrismaClient
}

function currentPrismaClient() {
  let executionContext: object
  try {
    executionContext = getCloudflareContext().ctx as object
  } catch {
    // Next build, local Next server and Vercel use ordinary Node processes.
    return globalForPrisma.bookeasyPrisma ??= createPrismaClient(false)
  }

  const existing = workerClients.get(executionContext)
  if (existing) return existing
  const client = createPrismaClient(true)
  workerClients.set(executionContext, client)
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property: keyof PrismaClient) {
    const client = currentPrismaClient()
    const value = client[property]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
