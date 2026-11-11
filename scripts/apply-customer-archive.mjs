import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.startsWith('postgres')) throw new Error('DATABASE_URL lipsește din build-ul de producție.')
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const sql = await readFile(new URL('../prisma/migrations/20261019150000_customer_archive/migration.sql', import.meta.url), 'utf8')
    await client.query(sql)
  } finally {
    await client.end()
  }
}
