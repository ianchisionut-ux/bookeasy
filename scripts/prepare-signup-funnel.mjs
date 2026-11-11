import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL lipsește pentru migrarea contoarelor de înscriere.')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 15000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2026110511)')
    await client.query(await readFile(new URL('../prisma/migrations/20261105110000_signup_funnel/migration.sql', import.meta.url), 'utf8'))
    await client.query('COMMIT')
    console.log('Contoarele agregate pentru înscrieri sunt pregătite.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
