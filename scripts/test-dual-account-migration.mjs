import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const db = new PGlite()
try {
  await db.exec('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "role" TEXT NOT NULL); CREATE UNIQUE INDEX "User_email_key" ON "User"("email");')
  await db.query('INSERT INTO "User" ("id", "email", "role") VALUES ($1, $2, $3), ($4, $5, $6)', ['client', 'both@example.test', 'CUSTOMER', 'owner', 'owner@example.test', 'OWNER'])
  const migration = await readFile(new URL('../prisma/migrations/20261104150000_dual_customer_business_accounts/migration.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  const oldClient = await db.query('SELECT "accountKind" FROM "User" WHERE "id" = $1', ['client'])
  assert.equal(oldClient.rows[0].accountKind, 'CUSTOMER')
  await db.query('INSERT INTO "User" ("id", "email", "role") VALUES ($1, $2, $3)', ['business', 'both@example.test', 'OWNER'])
  await db.query('INSERT INTO "User" ("id", "email", "role", "accountKind") VALUES ($1, $2, $3, $4)', ['customer', 'owner@example.test', 'CUSTOMER', 'CUSTOMER'])
  const both = await db.query('SELECT "accountKind" FROM "User" WHERE "email" = $1 ORDER BY "accountKind"', ['both@example.test'])
  assert.deepEqual(both.rows.map(row => row.accountKind), ['BUSINESS', 'CUSTOMER'])
  await assert.rejects(db.query('INSERT INTO "User" ("id", "email", "role") VALUES ($1, $2, $3)', ['duplicate', 'both@example.test', 'OWNER']))
  console.log('Dual account migration: existing customer preserved, same email across account types accepted, duplicate business rejected.')
} finally {
  await db.close()
}
