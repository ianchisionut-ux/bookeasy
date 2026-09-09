const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const dotenv = require('dotenv')
const { Client } = require('pg')

const migrationName = '20260909100000_fitness_portal'
const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', migrationName, 'migration.sql')
const envPath = process.env.BOOKEASY_ENV_PATH || 'C:/Users/ianch/Desktop/bookeasy/.env'
const mode = process.argv[2] || '--check'

function productionEnv() {
  const fileEnv = dotenv.parse(fs.readFileSync(envPath))
  if (!fileEnv.DATABASE_URL) throw new Error('DATABASE_URL lipsește din fișierul de mediu')
  return { ...process.env, DATABASE_URL: fileEnv.DATABASE_URL }
}

async function inspect(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'BusinessType' AND e.enumlabel = 'FITNESS'
      ) AS fitness,
      to_regclass('public."FitnessClient"') IS NOT NULL AS client_table,
      to_regclass('public."FitnessEntry"') IS NOT NULL AS entry_table,
      to_regclass('public."FitnessMessage"') IS NOT NULL AS message_table,
      to_regclass('public."FitnessSession"') IS NOT NULL AS session_table
  `)

  let migrationRecord = false
  try {
    const migration = await client.query(
      `SELECT 1 FROM "_prisma_migrations"
       WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL
       LIMIT 1`,
      [migrationName],
    )
    migrationRecord = migration.rowCount > 0
  } catch (error) {
    if (error?.code !== '42P01') throw error
  }

  return { ...result.rows[0], migration_record: migrationRecord }
}

async function main() {
  if (!['--check', '--dry-run', '--apply'].includes(mode)) {
    throw new Error('Folosește --check, --dry-run sau --apply')
  }

  const env = productionEnv()
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  })
  let shouldResolve = false

  await client.connect()
  try {
    const before = await inspect(client)
    shouldResolve = mode === '--apply' && !before.migration_record
    console.log('Schema FitEasy:', JSON.stringify(before))

    if (mode === '--check') return
    const states = [before.fitness, before.client_table, before.entry_table, before.message_table, before.session_table]
    const schemaAlreadyApplied = states.every(Boolean)
    if (states.some(Boolean)) {
      if (states.every(Boolean)) {
        console.log('Structurile FitEasy există deja; nu rulez din nou SQL-ul.')
      } else {
        throw new Error('Schema FitEasy este aplicată doar parțial; migrarea automată a fost oprită')
      }
    }

    if (!schemaAlreadyApplied) {
      const sql = fs.readFileSync(migrationPath, 'utf8')
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [migrationName])
      await client.query(sql)

      if (mode === '--dry-run') {
        await client.query('ROLLBACK')
        console.log('Migrarea a trecut verificarea și a fost anulată intenționat (dry-run).')
        return
      }

      await client.query('COMMIT')
      console.log('Structurile FitEasy au fost aplicate.')
    }
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally {
    await client.end()
  }

  if (shouldResolve) {
    const resolved = spawnSync(
      'npx',
      ['prisma', 'migrate', 'resolve', '--applied', migrationName],
      { cwd: path.join(__dirname, '..'), env, stdio: 'inherit', shell: process.platform === 'win32' },
    )
    if (resolved.status !== 0) {
      throw resolved.error || new Error('Schema a fost aplicată, dar înregistrarea Prisma a eșuat')
    }
  }
}

main().catch((error) => {
  console.error(`${error.name}: ${error.message}`)
  process.exit(1)
})
