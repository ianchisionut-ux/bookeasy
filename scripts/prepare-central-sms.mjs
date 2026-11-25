import { Client } from 'pg'
import { readFile } from 'node:fs/promises'

if (process.env.VERCEL_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.startsWith('postgres')) throw new Error('DATABASE_URL de producție lipsește pentru schema SMS centrală.')
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2142026110)')
    await client.query(await readFile(new URL('../prisma/migrations/20261017010000_central_sms_gateway/migration.sql', import.meta.url), 'utf8'))
    await client.query('COMMIT')
    console.log('Central SMS additive schema ready.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
