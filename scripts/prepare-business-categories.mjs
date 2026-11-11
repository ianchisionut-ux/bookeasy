import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const sql = await readFile(new URL('../prisma/migrations/20261019180000_recurring_business_categories/migration.sql', import.meta.url), 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 })
  await client.connect()
  try {
    // The new values commit before Next.js issues any queries with them.
    await client.query(sql)
    console.log('Recurring appointment categories prepared; existing businesses and data unchanged.')
  } finally {
    await client.end()
  }
}
