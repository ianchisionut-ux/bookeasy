import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

// Vercel nu permite extragerea locală a DATABASE_URL marcat Sensitive. Aplicăm
// această migrare aditivă în build-ul de producție, înainte de publicarea codului.
// Fișierul SQL este idempotent și poate fi înregistrat ulterior prin Prisma.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL de producție lipsește din build.')
  const sql = await readFile(new URL('../prisma/migrations/20261009100000_business_contract_signatures/migration.sql', import.meta.url), 'utf8')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2142026109)')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Schema contractelor BookEasy este pregătită.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

const result = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (result.status !== 0) process.exit(result.status ?? 1)
