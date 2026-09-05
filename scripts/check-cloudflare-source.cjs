// Read-only migration audit. Print counts and validation results, never secrets.
const fs = require('node:fs')
const crypto = require('node:crypto')
const { parse } = require('dotenv')
const { Client } = require('pg')

async function main() {
  const env = parse(fs.readFileSync(process.argv[2]))
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000 })
  try {
    await client.connect()
    await client.query('BEGIN READ ONLY')
    for (const [label, sql] of Object.entries({
      invoices: 'SELECT "billingInvoiceUrl" AS url FROM "Business" WHERE "billingInvoiceUrl" IS NOT NULL',
      documents: 'SELECT url FROM "PatientDocument"',
      photos: 'SELECT url FROM "BusinessPhoto"',
    })) {
      const { rows } = await client.query(sql)
      console.log(label, JSON.stringify({ total: rows.length, legacy: rows.filter(r => !r.url.startsWith('r2://') && !r.url.startsWith('/api/storage/public/')).length }))
    }
    for (const table of ['Channel', 'GoogleCalendarConnection']) {
      const { rows } = await client.query(`SELECT "accessToken" FROM "${table}"`)
      let valid = 0
      for (const row of rows) {
        try {
          const b = Buffer.from(row.accessToken, 'base64')
          const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(env.ENCRYPTION_KEY, 'hex'), b.subarray(0, 12))
          decipher.setAuthTag(b.subarray(12, 28))
          decipher.update(b.subarray(28)); decipher.final(); valid++
        } catch {}
      }
      console.log(table, JSON.stringify({ total: rows.length, decryptableWithSourceKey: valid }))
    }
  } finally {
    await client.query('ROLLBACK').catch(() => {})
    await client.end()
  }
}
main().catch(error => { console.error('Migration source audit failed:', error.code || error.name); process.exitCode = 1 })
