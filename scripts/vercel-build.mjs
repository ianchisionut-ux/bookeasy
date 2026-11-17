await import('./prepare-service-prices.mjs')
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

// Vercel nu permite extragerea locală a DATABASE_URL marcat Sensitive. Aplicăm
// această migrare aditivă în build-ul de producție, înainte de publicarea codului.
// Fișierul SQL este idempotent și poate fi înregistrat ulterior prin Prisma.
if (process.env.VERCEL_ENV === 'production' && process.env.BOOKEASY_SKIP_DB_RELEASE_PREP !== 'true') {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL de producție lipsește din build.')
  const migrationFiles = [
    '../prisma/migrations/20261015181000_business_channel_identity/migration.sql',
    '../prisma/migrations/20261009100000_business_contract_signatures/migration.sql',
    '../prisma/migrations/20261012170000_dental_clinic_chart/migration.sql',
    '../prisma/migrations/20261013110000_platform_email_inbox/migration.sql',
    '../prisma/migrations/20261013130000_platform_email_html/migration.sql',
    '../prisma/migrations/20261013150000_beauty_categories/migration.sql',
    '../prisma/migrations/20261013170000_verified_customer_reviews/migration.sql',
    '../prisma/migrations/20261015160000_booking_arrival/migration.sql',
    '../prisma/migrations/20261016133000_operator_inbox_visibility/migration.sql',
    '../prisma/migrations/20261016150000_sms_gateway/migration.sql',
    '../prisma/migrations/20261016170000_bookeasy_sms_device/migration.sql',
    '../prisma/migrations/20261016170000_customer_merge_archive/migration.sql',
    '../prisma/migrations/20261019150000_customer_archive/migration.sql',
    '../prisma/migrations/20261105110000_signup_funnel/migration.sql',
  ]
  const migrations = await Promise.all(migrationFiles.map((file) => readFile(new URL(file, import.meta.url), 'utf8')))
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2142026109)')
    for (const sql of migrations) await client.query(sql)
    await client.query('COMMIT')
    console.log('Schema BookEasy este pregătită (contracte, odontogramă, inbox și SMS gateway).')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

if (process.env.VERCEL_ENV === 'production' && process.env.BOOKEASY_SKIP_DB_RELEASE_PREP !== 'true') {
  const merge = spawnSync('npx', ['tsx', 'scripts/merge-customers-release.ts'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (merge.status !== 0) process.exit(merge.status ?? 1)
}

const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (result.status !== 0) process.exit(result.status ?? 1)
