import {readFile} from 'node:fs/promises'
import {Client} from 'pg'
if(process.env.VERCEL_ENV==='production'){
 const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:15000});await client.connect()
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(2026110120)');await client.query(await readFile(new URL('../prisma/migrations/20261101200000_business_invitations/migration.sql',import.meta.url),'utf8'));await client.query(await readFile(new URL('../prisma/migrations/20261104120000_business_invitation_promo/migration.sql',import.meta.url),'utf8'));await client.query(await readFile(new URL('../prisma/migrations/20261105160000_business_invitation_header/migration.sql',import.meta.url),'utf8'));await client.query('COMMIT');console.log('Business invitations, promotional codes and email headers prepared; no messages sent.')}catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}
}
