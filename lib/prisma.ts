import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { retryDatabaseRead } from './database-read-retry'

const globalForPrisma = globalThis as unknown as { bookeasyPrisma?: PrismaClient }
const workerClients = new WeakMap<object, PrismaClient>()

type DatabaseEnv = { DATABASE_URL?: string; BOOKEASY_CLOUDFLARE_PREVIEW?: string; BOOKEASY_PREVIEW_DATABASE_URL?: string }

function createPrismaClient(inWorker: boolean, env?: DatabaseEnv) {
  const preview = inWorker && env?.BOOKEASY_CLOUDFLARE_PREVIEW === 'true'
  // Preview must opt in to its own database secret. Ignore DATABASE_URL even if
  // a production secret was accidentally copied onto the preview Worker.
  const connectionString = preview ? env?.BOOKEASY_PREVIEW_DATABASE_URL : process.env.DATABASE_URL
  if (preview && (!connectionString || connectionString === (env?.DATABASE_URL ?? process.env.DATABASE_URL))) {
    throw new Error('BOOKEASY_PREVIEW_DATABASE_URL trebuie configurat separat de DATABASE_URL pentru Preview.')
  }
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
    // Next build and the local Next server use ordinary Node processes.
    return globalForPrisma.bookeasyPrisma ??= createPrismaClient(false)
  }

  const existing = workerClients.get(executionContext)
  if (existing) return existing
  const env = getCloudflareContext().env as DatabaseEnv
  const client = createPrismaClient(true, env)
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
