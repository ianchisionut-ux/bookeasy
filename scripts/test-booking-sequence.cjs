const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')

async function main() {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE "Business" ("id" TEXT PRIMARY KEY);
      INSERT INTO "Business" ("id") VALUES ('business-a'), ('business-b')`)
    await db.exec(`CREATE TABLE "Booking" (
      "id" TEXT PRIMARY KEY,
      "businessId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "sequenceNumber" INTEGER
    )`)
    // Existing duplicates are preserved. The UTC timestamp at 22:30 on
    // October 31 is already November 1 in Bucharest.
    await db.exec(`INSERT INTO "Booking" ("id", "businessId", "createdAt", "sequenceNumber") VALUES
      ('old-oct', 'business-a', '2026-10-31 21:30:00', 50),
      ('old-nov-boundary', 'business-a', '2026-10-31 22:30:00', 7),
      ('old-nov-1', 'business-a', '2026-11-01 08:00:00', 1),
      ('old-nov-2', 'business-a', '2026-11-01 09:00:00', 1),
      ('old-other-business', 'business-b', '2026-11-01 08:00:00', 3)`)

    const migration = await fs.readFile(path.join(__dirname, '..', 'prisma/migrations/20261124190000_atomic_booking_sequences/migration.sql'), 'utf8')
    await db.exec(migration)
    await db.exec(migration)

    async function insert(id, businessId, createdAt, attemptedNumber) {
      const result = await db.query(`INSERT INTO "Booking" ("id", "businessId", "createdAt", "sequenceNumber")
        VALUES ($1, $2, $3, $4) RETURNING "sequenceNumber"`, [id, businessId, createdAt, attemptedNumber])
      return result.rows[0].sequenceNumber
    }
    assert.equal(await insert('nov-new-1', 'business-a', '2026-11-24 12:00:00', 1), 8)
    assert.equal(await insert('nov-new-2', 'business-a', '2026-11-24 12:01:00', null), 9)
    assert.equal(await insert('dec-boundary', 'business-a', '2026-11-30 22:30:00', 99), 1)
    assert.equal(await insert('oct-new', 'business-a', '2026-10-31 21:40:00', 1), 51)
    assert.equal(await insert('other-business', 'business-b', '2026-11-24 12:00:00', 1), 4)

    const parallel = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      insert(`parallel-${index}`, 'business-a', '2026-11-24 13:00:00', 1)))
    assert.deepEqual([...parallel].sort((a, b) => a - b), Array.from({ length: 20 }, (_, index) => index + 10))

    await db.exec('BEGIN')
    assert.equal(await insert('rolled-back', 'business-a', '2026-11-24 14:00:00', 1), 30)
    await db.exec('ROLLBACK')
    assert.equal(await insert('after-rollback', 'business-a', '2026-11-24 14:01:00', 1), 30)
    const historical = await db.query(`SELECT "sequenceNumber" FROM "Booking"
      WHERE "id" IN ('old-nov-1', 'old-nov-2') ORDER BY "id"`)
    assert.deepEqual(historical.rows.map(row => row.sequenceNumber), [1, 1])
    await db.exec(`DELETE FROM "Business" WHERE "id" = 'business-b'`)
    const orphanedCounter = await db.query(`SELECT 1 FROM "BookingSequence" WHERE "businessId" = 'business-b'`)
    assert.equal(orphanedCounter.rows.length, 0)
    console.log('PASS atomic monthly sequences: repeated migration, old duplicates preserved, Bucharest month boundary, separate businesses, concurrent inserts, rollback, business cleanup')
  } finally {
    await db.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
