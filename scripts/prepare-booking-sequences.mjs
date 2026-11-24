import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.startsWith('postgres')) {
    throw new Error('DATABASE_URL de producție lipsește; numerele rezervărilor nu pot fi pregătite.')
  }

  const migration = await readFile(
    new URL('../prisma/migrations/20261124190000_atomic_booking_sequences/migration.sql', import.meta.url),
    'utf8',
  )
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(21420261124)')
    await client.query(migration)
    const result = await client.query(`SELECT 1 FROM pg_trigger
      WHERE tgname = 'bookeasy_assign_booking_sequence'
        AND tgrelid = '"Booking"'::regclass`)
    if (result.rowCount !== 1) throw new Error('Triggerul de numerotare a rezervărilor lipsește.')
    await client.query('COMMIT')
    console.log('Numerotarea atomică a rezervărilor este pregătită.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
