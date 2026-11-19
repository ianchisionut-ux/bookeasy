import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

export async function preparePromotionCampaigns(client) {
  // The original migration backfills LANSARE2 whenever the legacy code is null.
  // A row with both an archive timestamp and a null code was permanently removed.
  // JSON keys also work before the original migration has added its columns.
  const legacy = await client.query(`
    SELECT to_jsonb(c)->>'deletedAt' IS NOT NULL AND to_jsonb(c)->>'code' IS NULL AS purged
    FROM "LaunchCampaign" c WHERE c."id" = $1
  `, ['bookeasy-launch-2026'])
  if (legacy.rows[0]?.purged) return

  const sql = await readFile(new URL('../prisma/migrations/20261101160000_promotion_campaigns/migration.sql', import.meta.url), 'utf8')
  await client.query(sql)
}

if (process.env.VERCEL_ENV === 'production') {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 15000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(2026110116)')
    await client.query('LOCK TABLE "LaunchCampaign" IN ACCESS EXCLUSIVE MODE')
    await preparePromotionCampaigns(client)
    await client.query('COMMIT')
    console.log('Promotion campaigns prepared; existing enrollments and billing unchanged.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
