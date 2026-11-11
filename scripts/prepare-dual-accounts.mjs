import {readFile} from 'node:fs/promises'
import {Client} from 'pg'

if(process.env.VERCEL_ENV==='production'){
 const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:15000})
 await client.connect()
 try{
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock(2026110415)')
  await client.query(await readFile(new URL('../prisma/migrations/20261104150000_dual_customer_business_accounts/migration.sql',import.meta.url),'utf8'))
  await client.query('COMMIT')
  console.log('Separate customer and business account identities prepared.')
 }catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}
}
