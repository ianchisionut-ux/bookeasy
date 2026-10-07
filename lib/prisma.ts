import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Vercel rulează fiecare funcție în Node.js. Refolosim clientul în instanțele
// calde, iar Neon gestionează conexiunile către baza de date existentă.
const globalForPrisma = globalThis as unknown as { bookeasyPrisma?: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL nu este configurat în Vercel.')
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property: keyof PrismaClient) {
    const client = globalForPrisma.bookeasyPrisma ??= createPrismaClient()
    const value = client[property]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
