import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const sql = await readFile(new URL('../prisma/migrations/20261019190000_two_month_launch_offer/migration.sql', import.meta.url), 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    // The current campaign migration owns the terms constraint; do not restore obsolete fixed prices.
    await client.query('COMMIT')
    console.log('Two-month offer prepared; billed or paid historical enrollments preserved.')
    const terms = await client.query('SELECT "freeMonths","promoMonths","promoMinor","regularMinor",COUNT(*)::int AS count,COUNT(*) FILTER (WHERE "activatedAt" IS NOT NULL)::int AS activated,COUNT(*) FILTER (WHERE "cancelledAt" IS NOT NULL)::int AS cancelled FROM "LaunchEnrollment" GROUP BY 1,2,3,4')
    const history = await client.query('SELECT COUNT(*) FILTER (WHERE p."amountMinor">0)::int AS charged,COUNT(*) FILTER (WHERE p."amountMinor">0 AND p."paidAt" IS NOT NULL)::int AS paid,COUNT(*) FILTER (WHERE p."invoiceUrl" IS NOT NULL OR p."invoiceExternalId" IS NOT NULL)::int AS invoiced FROM "LaunchBillingPeriod" p JOIN "LaunchEnrollment" e ON e.id=p."enrollmentId" WHERE e."freeMonths"<>2 OR e."promoMonths"<>0 OR e."promoMinor"<>0')
    console.log('LAUNCH_AUDIT ' + JSON.stringify({terms:terms.rows,legacyHistory:history.rows}))
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { await client.end() }
}
