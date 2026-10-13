import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

// Vercel nu permite extragerea locală a DATABASE_URL marcat Sensitive. Aplicăm
// această migrare aditivă în build-ul de producție, înainte de publicarea codului.
// Fișierul SQL este idempotent și poate fi înregistrat ulterior prin Prisma.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL de producție lipsește din build.')
  const migrationFiles = [
    '../prisma/migrations/20261009100000_business_contract_signatures/migration.sql',
    '../prisma/migrations/20261012170000_dental_clinic_chart/migration.sql',
    '../prisma/migrations/20261013110000_platform_email_inbox/migration.sql',
    '../prisma/migrations/20261013130000_platform_email_html/migration.sql',
    '../prisma/migrations/20261013150000_beauty_categories/migration.sql',
    '../prisma/migrations/20261013170000_verified_customer_reviews/migration.sql',
    '../prisma/migrations/20261013180000_customer_accounts/migration.sql',
  ]
  const migrations = await Promise.all(migrationFiles.map((file) => readFile(new URL(file, import.meta.url), 'utf8')))
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2142026109)')
    for (const sql of migrations) await client.query(sql)
    await client.query('COMMIT')
    console.log('Schema BookEasy este pregătită (contracte, odontogramă și inbox).')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (result.status !== 0) process.exit(result.status ?? 1)
