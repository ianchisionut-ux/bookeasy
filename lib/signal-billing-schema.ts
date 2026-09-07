import { prisma } from '@/lib/prisma'

let schemaPromise: Promise<unknown> | null = null

/**
 * Cloudflare injects the database credentials at runtime, so migrations run here
 * as an idempotent safety net before code reads the newly added billing fields.
 */
export function ensureSignalBillingSchema() {
  if (!schemaPromise) {
    schemaPromise = prisma.$executeRawUnsafe(`
      ALTER TABLE "Business"
      ADD COLUMN IF NOT EXISTS "billingSubtotal" DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS "billingVatRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
      ADD COLUMN IF NOT EXISTS "billingInvoiceExternalId" TEXT,
      ADD COLUMN IF NOT EXISTS "billingLegalName" TEXT,
      ADD COLUMN IF NOT EXISTS "billingClientType" TEXT NOT NULL DEFAULT 'PJ',
      ADD COLUMN IF NOT EXISTS "billingCif" TEXT,
      ADD COLUMN IF NOT EXISTS "billingRegCom" TEXT,
      ADD COLUMN IF NOT EXISTS "billingAddress" TEXT,
      ADD COLUMN IF NOT EXISTS "billingCounty" TEXT,
      ADD COLUMN IF NOT EXISTS "billingCity" TEXT,
      ADD COLUMN IF NOT EXISTS "billingPostalCode" TEXT,
      ADD COLUMN IF NOT EXISTS "billingEmail" TEXT
    `).catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}
