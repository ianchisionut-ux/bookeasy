import { prisma } from '../lib/prisma'
import { mergeBusinessCustomers } from '../lib/customer-merge'

async function main() {
  const businesses = await prisma.customer.findMany({ distinct: ['businessId'], select: { businessId: true } })
  let merged = 0
  for (const { businessId } of businesses) {
    const result = await mergeBusinessCustomers(businessId)
    if (result.skipped.length) throw new Error('Un grup de clienți necesită verificare înainte de activarea unicității telefoanelor.')
    merged += result.merged
  }
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION bookeasy_customer_phone(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE WHEN normalized ~ '^[1-9][0-9]{7,14}$' THEN normalized ELSE NULL END FROM (
      SELECT CASE WHEN digits ~ '^0[0-9]{9}$' THEN '40'||substring(digits from 2) WHEN digits LIKE '00%' THEN substring(digits from 3) ELSE digits END AS normalized
      FROM (SELECT regexp_replace(value, '[^0-9]', '', 'g') AS digits) d
    ) n
  $$`)
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Customer_businessId_canonical_phone_key" ON "Customer" ("businessId", bookeasy_customer_phone(phone))')
  console.log(`Customer duplicates merged: ${merged}. Normalized phone uniqueness enabled.`)
}
main().catch(() => { console.error('Customer merge validation failed; release stopped.'); process.exitCode = 1 }).finally(() => prisma.$disconnect())
