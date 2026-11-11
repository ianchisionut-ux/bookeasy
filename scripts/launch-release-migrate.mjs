// Explicit, one-off release command. Normal builds never call this file.
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { Client, Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import ts from 'typescript'
import assert from 'node:assert/strict'

if (process.env.BOOKEASY_APPROVED_RELEASE !== '2026-10-15' || process.env.VERCEL_ENV !== 'production') throw new Error('Explicit production release approval marker is required')
const connectionString = process.env.DATABASE_URL
if (!connectionString || !new URL(connectionString).hostname.endsWith('.neon.tech')) throw new Error('Expected the existing Neon production database')
const migrationNames = ['20261013180000_customer_accounts', '20261013190000_client_booking_profiles', '20261015210000_fitness_client_prerequisites', '20261015220000_fitness_coaching', '20261015233000_launch_campaign']
const db = new Client({ connectionString })
let phase = 'connect'
const counts = async () => (await db.query('SELECT (SELECT count(*)::int FROM "Business") AS businesses, (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Customer") AS customers, (SELECT count(*)::int FROM "Booking") AS bookings, (SELECT count(*)::int FROM "Channel") AS channels')).rows[0]
try {
  await db.connect()
  const before = await counts()
  console.log('[release] Production preflight counts', JSON.stringify(before))
  console.log('[release] Backup: Neon production snapshot, 2026-10-15 18:47:07 UTC; previous deployment dpl_GCHwMhH4w5JpG13uCfaWR7ebisWt')
  await db.query('BEGIN')
  await db.query("SET LOCAL lock_timeout = '10s'")
  await db.query("SET LOCAL statement_timeout = '90s'")
  await db.query('SELECT pg_advisory_xact_lock(2142026109)')
  await db.query('CREATE TABLE IF NOT EXISTS "_BookeasyReleaseMigration" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())')
  for (const name of migrationNames) {
    phase = name
    const sql = await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8')
    const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
    const previous = (await db.query('SELECT checksum FROM "_BookeasyReleaseMigration" WHERE name=$1', [name])).rows[0]
    if (previous) { assert.equal(previous.checksum, checksum, 'Applied migration checksum mismatch'); continue }
    await db.query(sql)
    await db.query('INSERT INTO "_BookeasyReleaseMigration" (name,checksum) VALUES ($1,$2)', [name, checksum])
    console.log('[release] Applied', name)
  }
  assert.deepEqual(await counts(), before, 'Existing row counts must remain unchanged')
  await db.query('COMMIT')
  console.log('[release] Migration transaction committed; existing row counts preserved')

  phase = 'prisma-rollback-verification'
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString, max: 8 })) })
  const require = createRequire(import.meta.url)
  async function load(file, mocks = {}) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8')
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const module = { exports: {} }
    new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports)
    return module.exports
  }
  try {
    const policy = await load('lib/launch-policy.ts')
    const resetIpayPaymentFields = () => Object.fromEntries(['OrderId', 'OrderNumber', 'PaymentState', 'PaymentError', 'StartedAt', 'AmountMinor', 'Currency', 'InvoiceReference'].map(suffix => ['billingIpay' + suffix, null]))
    const launch = await load('lib/launch-campaign.ts', { './prisma': { prisma }, './launch-policy': policy, './billing-ipay': { resetIpayPaymentFields } })
    let verified = false
    try {
      await prisma.$transaction(async tx => {
        const token = randomUUID(), anchor = new Date('2026-01-31T10:00:00Z'), now = new Date('2026-04-30T10:00:00Z')
        const account = await tx.business.create({ data: { name: 'Verificare tranzacțională lansare', slug: 'release-rollback-' + token, category: 'FITNESS', teamSize: 1, publicListed: false, billingStatus: 'GRATUIT', billingAmount: 0,
          users: { create: { email: `release-${token}@example.invalid`, password: 'unusable-release-verification', role: 'OWNER' } },
          launchEnrollment: { create: { campaignId: policy.LAUNCH_CAMPAIGN_ID, ...policy.LAUNCH_OFFER } },
        } })
        await launch.lockLaunchBusiness(tx, account.id)
        await launch.activateLaunch(tx, account.id, anchor)
        await launch.syncLaunchInTransaction(tx, account.id, now)
        await launch.syncLaunchInTransaction(tx, account.id, now)
        const enrollment = await tx.launchEnrollment.findUniqueOrThrow({ where: { businessId: account.id }, include: { periods: { orderBy: { cycle: 'asc' } } } })
        assert.deepEqual(enrollment.periods.map(p => p.amountMinor), [0, 0, 5500, 5500])
        assert.equal(enrollment.billingCycle, 1)
        assert.equal(Number((await tx.business.findUniqueOrThrow({ where: { id: account.id } })).billingAmount), 28)
        for (const cycle of [1, 2]) {
          await tx.launchBillingPeriod.update({ where: { id: enrollment.periods[cycle].id }, data: { paidAt: now } })
          await tx.business.update({ where: { id: account.id }, data: { billingStatus: 'PLATIT', billingPaidAt: now } })
          await launch.syncLaunchInTransaction(tx, account.id, now)
        }
        assert.equal(Number((await tx.business.findUniqueOrThrow({ where: { id: account.id } })).billingAmount), 55)
        verified = true
        throw new Error('BOOKEASY_VERIFIED_ROLLBACK')
      }, { timeout: 25000 })
    } catch (error) { if (error.message !== 'BOOKEASY_VERIFIED_ROLLBACK') throw error }
    assert.equal(verified, true)
    assert.deepEqual(await counts(), before, 'Verification records must roll back completely')
    console.log('[release] Real Neon + Prisma checks passed: atomic enrollment, month boundaries, idempotency, 0/28/28/55, debt carryover; all synthetic records rolled back')
    phase = 'concurrent-neon-rollback-verification'
    const results = await Promise.allSettled(Array.from({ length: 40 }, async () => {
      let created = false
      const token = randomUUID(), started = performance.now()
      try {
        await prisma.$transaction(async tx => {
          const account = await tx.business.create({ data: { name: 'Verificare concurență tranzacțională', slug: 'release-rollback-' + token, category: 'FITNESS', teamSize: 1, publicListed: false, billingStatus: 'GRATUIT', billingAmount: 0,
            users: { create: { email: `release-${token}@example.invalid`, password: 'unusable-rollback-check', role: 'OWNER' } },
            launchEnrollment: { create: { campaignId: policy.LAUNCH_CAMPAIGN_ID, ...policy.LAUNCH_OFFER } },
          }, include: { users: true, launchEnrollment: true } })
          assert.equal(account.users.length, 1)
          assert.equal(account.launchEnrollment.promoMinor, 0)
          created = true
          throw new Error('BOOKEASY_VERIFIED_ROLLBACK')
        }, { maxWait: 60000, timeout: 20000 })
      } catch (error) { if (error.message !== 'BOOKEASY_VERIFIED_ROLLBACK') throw error }
      assert.equal(created, true)
      return Math.round(performance.now() - started)
    }))
    const failed = results.filter(result => result.status === 'rejected')
    console.log('[release] Real Neon concurrent enrollment checks', JSON.stringify({ requests: 40, poolMax: 8, passed: 40 - failed.length, failed: failed.length, syntheticRecordsCommitted: 0 }))
    if (failed.length) throw new Error('Concurrent enrollment verification failed')
    assert.deepEqual(await counts(), before, 'Concurrent verification records must roll back completely')
  } finally { await prisma.$disconnect() }
} catch (error) {
  await db.query('ROLLBACK').catch(() => {})
  console.error('[release] Failed phase', phase, 'code', error.code || error.name)
  process.exitCode = 1
} finally { await db.end().catch(() => {}) }
