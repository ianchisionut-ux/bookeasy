import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

if (process.env.VERCEL_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.startsWith('postgres')) {
    throw new Error('DATABASE_URL de producție lipsește pentru migrarea pinurilor.')
  }

  const migration = await readFile(
    new URL('../prisma/migrations/20261121113500_confirm_business_map_location/migration.sql', import.meta.url),
    'utf8',
  )
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 15000 })
  await client.connect()
  try {
    await client.query(migration)
    console.log('Schema confirmării manuale a pinurilor este pregătită.')
  } finally {
    await client.end()
  }
}
