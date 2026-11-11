import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
if (process.env.VERCEL_ENV === 'production') {
 const client = new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:15000})
 await client.connect()
 try { await client.query(await readFile(new URL('../prisma/migrations/20261111190000_optional_service_prices/migration.sql',import.meta.url),'utf8')); console.log('Optional service prices ready; existing amounts preserved.') } finally { await client.end() }
}
