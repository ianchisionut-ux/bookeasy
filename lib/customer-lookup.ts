import type { Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canonicalCustomerPhone } from '@/lib/customer-phone'

export async function findCustomerByPhone(businessId: string, value: string) {
  const phone = canonicalCustomerPhone(value)
  if (!phone.startsWith('+')) return prisma.customer.findFirst({ where: { businessId, phone } })
  const rows = await prisma.$queryRaw<Customer[]>`
    SELECT c.* FROM "Customer" c
    CROSS JOIN LATERAL (SELECT regexp_replace(c.phone, '[^0-9]', '', 'g') AS digits) d
    WHERE c."businessId" = ${businessId}
      AND '+' || CASE
        WHEN digits ~ '^0[0-9]{9}$' THEN '40' || substring(digits from 2)
        WHEN digits LIKE '00%' THEN substring(digits from 3)
        ELSE digits END = ${phone}
    ORDER BY c."createdAt" ASC LIMIT 1
  `
  return rows[0] || null
}
