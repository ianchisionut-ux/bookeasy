import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
if (process.env.VERCEL_ENV === 'production') {
  const sql = await readFile(new URL('../prisma/migrations/20261017110000_native_google_handoff/migration.sql', import.meta.url), 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2026101711)')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Temporary native Google sign-in storage prepared; existing tables unchanged.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { await client.end() }
}
