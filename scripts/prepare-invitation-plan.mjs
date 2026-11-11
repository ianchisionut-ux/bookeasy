import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 15000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2026110418)')
    const sql = await readFile(new URL('../prisma/migrations/20261104180000_invitation_offered_plan/migration.sql', import.meta.url), 'utf8')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Invitation plan schema prepared.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { await client.end() }
}
