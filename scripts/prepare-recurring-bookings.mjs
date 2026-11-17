import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.startsWith('postgres')) {
    throw new Error('DATABASE_URL de producție lipsește; schema programărilor recurente nu poate fi pregătită.')
  }

  const migration = await readFile(
    new URL('../prisma/migrations/20261117180000_recurring_bookings/migration.sql', import.meta.url),
    'utf8',
  )
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(21420261117)')
    await client.query(migration)
    await client.query('SELECT "seriesId" FROM "Booking" LIMIT 0')
    await client.query('SELECT "id" FROM "BookingSeries" LIMIT 0')
    await client.query('COMMIT')
    console.log('Schema programărilor recurente este pregătită.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
