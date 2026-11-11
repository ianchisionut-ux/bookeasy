import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
if(process.env.VERCEL_ENV === 'production') {
 const client = new Client({connectionString:process.env.DATABASE_URL})
 await client.connect()
 try {
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock(2142026110)')
  await client.query(await readFile(new URL('../prisma/migrations/20261017010000_central_sms_gateway/migration.sql',import.meta.url),'utf8'))
  await client.query('COMMIT')
  console.log('Central SMS additive schema ready.')
 } catch(error) { await client.query('ROLLBACK'); throw error } finally {await client.end()}
}
const result=spawnSync('npx',['next','build'],{stdio:'inherit',shell:process.platform==='win32'})
process.exit(result.status??1)
