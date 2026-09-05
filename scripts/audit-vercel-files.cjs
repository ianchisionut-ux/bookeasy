const fs = require('node:fs')
const { parse } = require('dotenv')
const { Client } = require('pg')
async function main() {
  const env = parse(fs.readFileSync(process.argv[2]))
  const db = new Client({ connectionString: env.DATABASE_URL })
  await db.connect()
  try {
    await db.query('BEGIN READ ONLY')
    const { rows: columns } = await db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND data_type IN ('text','character varying')")
    const quote = (s) => '"' + s.replaceAll('"', '""') + '"'
    for (const { table_name: table, column_name: column } of columns) {
      const { rows } = await db.query(`SELECT ${quote(column)} AS value FROM ${quote(table)} WHERE ${quote(column)} LIKE '%vercel%'`)
      if (rows.length) console.log(JSON.stringify({ table, column, count: rows.length, publicUrls: rows.map(r => r.value).filter(v => /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(v)) }))
    }
    await db.query('ROLLBACK')
  } finally { await db.end() }
}
main().catch(e => { console.error(e.code || e.name); process.exitCode = 1 })
