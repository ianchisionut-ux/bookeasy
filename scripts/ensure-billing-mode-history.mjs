import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL de producție lipsește din build.')
  const sql = await readFile(new URL('../prisma/migrations/20261102120000_billing_mode_history/migration.sql', import.meta.url), 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2142026112)')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Istoricul schimbărilor de abonament este pregătit.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
