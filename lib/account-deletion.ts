import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import Stripe from 'stripe'
import { prisma } from './prisma'
import { clientIdentity } from './client-profile'
import { accountHash } from './session-revocation'
import { encrypt } from './crypto'
import { deleteR2File, r2Key } from './r2-storage'

export type DeletionKind = 'CUSTOMER' | 'BUSINESS'
export class DeletionError extends Error {
  constructor(message: string, public status = 409) { super(message) }
}
export type DeletionTarget = { kind: DeletionKind; actorKey: string; targetKey: string; confirmation: string; businessId?: string; ownerKey?: string; email?: string; googleSub?: string | null; userId: string }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function deletionTarget(session: Session | null, kind: DeletionKind): Promise<DeletionTarget | null> {
  const details = session as any
  if (!details?.userId || details.isSuperAdmin || details.isImpersonatingBusiness) return null
  if (kind === 'CUSTOMER') {
    const identity = clientIdentity(session)
    if (!identity || details.businessId) return null
    return { kind, actorKey: identity.ownerKey, targetKey: identity.ownerKey, confirmation: 'STERGE', ownerKey: identity.ownerKey, email: identity.email, googleSub: identity.googleSub, userId: details.userId }
  }
  if (details.role !== 'OWNER' || !details.businessId) return null
  const user = await prisma.user.findUnique({ where: { id: details.userId }, select: { role: true, businessId: true } })
  if (user?.role !== 'OWNER' || !user.businessId || user.businessId !== details.businessId) return null
  const business = await prisma.business.findUnique({ where: { id: user.businessId }, select: { name: true } })
  return business ? { kind, actorKey: `user:${details.userId}`, targetKey: `business:${user.businessId}`, confirmation: business.name, businessId: user.businessId, userId: details.userId } : null
}

export async function prepareDeletion(target: DeletionTarget) {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token), actorHash = accountHash(target.actorKey), targetHash = accountHash(target.targetKey)
  const expiresAt = await prisma.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM "AccountDeletionChallenge" WHERE "expiresAt" < clock_timestamp() OR ("actorHash" = ${actorHash} AND "kind" = ${target.kind})`
    const rows = await tx.$queryRaw<{ expiresAt: Date }[]>`INSERT INTO "AccountDeletionChallenge" ("tokenHash", "actorHash", "targetHash", "kind", "expiresAt") VALUES (${tokenHash}, ${actorHash}, ${targetHash}, ${target.kind}, clock_timestamp() + interval '5 minutes') RETURNING "expiresAt"`
    return rows[0].expiresAt
  })
  return { token, expiresAt: expiresAt.toISOString(), confirmation: target.confirmation }
}

async function consumeChallenge(tx: Prisma.TransactionClient, target: DeletionTarget, token: string) {
  const tokenHash = hashToken(token), actorHash = accountHash(target.actorKey), targetHash = accountHash(target.targetKey)
  const rows = await tx.$queryRaw<{ tokenHash: string }[]>`DELETE FROM "AccountDeletionChallenge" WHERE "tokenHash" = ${tokenHash} AND "actorHash" = ${actorHash} AND "targetHash" = ${targetHash} AND "kind" = ${target.kind} AND "expiresAt" > clock_timestamp() RETURNING "tokenHash"`
  if (rows.length !== 1) throw new DeletionError('Confirmarea a expirat sau nu mai este validă. Reia cei doi pași.')
}

async function revoke(tx: Prisma.TransactionClient, keys: string[]) {
  for (const key of new Set(keys)) {
    const ownerHash = accountHash(key)
    await tx.$executeRaw`INSERT INTO "AccountRevocation" ("ownerHash", "revokedAt") VALUES (${ownerHash}, clock_timestamp()) ON CONFLICT ("ownerHash") DO UPDATE SET "revokedAt" = clock_timestamp()`
  }
}

async function deletePersonal(tx: Prisma.TransactionClient, target: DeletionTarget) {
  // Google proves email ownership. A password account must match its own user ID;
  // never let an unverified password account erase another Google identity by email.
  const users = await tx.user.findMany({ where: { role: 'CUSTOMER', businessId: null, ...(target.googleSub ? { email: target.email!.toLowerCase() } : { id: target.userId }) }, select: { id: true } })
  const ownerKeys = [...new Set([target.ownerKey!, ...users.map(user => `user:${user.id}`)])]
  const profiles = await tx.clientProfile.findMany({ where: { ownerKey: { in: ownerKeys } }, select: { id: true } })
  const bookingScope = { OR: [{ clientProfileId: { in: profiles.map(profile => profile.id) } }, ...(target.googleSub ? [{ reviewerGoogleSub: target.googleSub }] : [])] }
  await revoke(tx, ownerKeys)
  await tx.review.deleteMany({ where: { source: 'bookeasy', booking: bookingScope } })
  await tx.booking.updateMany({ where: bookingScope, data: { clientProfileId: null, reviewerGoogleSub: null } })
  await tx.fitnessMember.updateMany({ where: { clientProfileId: { in: profiles.map(profile => profile.id) } }, data: { clientProfileId: null } })
  await tx.clientProfile.deleteMany({ where: { ownerKey: { in: ownerKeys } } })
  await tx.passwordResetToken.deleteMany({ where: { userId: { in: users.map(user => user.id) } } })
  await tx.user.deleteMany({ where: { id: { in: users.map(user => user.id) }, role: 'CUSTOMER', businessId: null } })
  if (target.googleSub) await tx.$executeRaw`DELETE FROM "NativeGoogleFlow" WHERE "payload"->>'googleSub' = ${target.googleSub}`
}

async function deleteBusiness(tx: Prisma.TransactionClient, target: DeletionTarget) {
  const businessId = target.businessId!
  await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`
  const business = await tx.business.findUnique({ where: { id: businessId } })
  const actor = await tx.user.findUnique({ where: { id: target.userId } })
  if (!business || actor?.businessId !== businessId || actor.role !== 'OWNER') throw new DeletionError('Nu mai ai acces la această afacere.', 403)
  if (business.name !== target.confirmation) throw new DeletionError('Numele afacerii s-a schimbat. Reia confirmarea.')
  const users = await tx.user.findMany({ where: { businessId }, select: { id: true } })
  const contracts = await tx.contractSignature.findMany({ where: { businessId } })
  const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId }, include: { periods: true } })
  const periods = enrollment?.periods.filter(period => period.paidAt || period.invoiceUrl || period.invoiceExternalId) ?? []
  const subscription = await tx.subscription.findUnique({ where: { businessId } })
  // Do not leave a paid recurring subscription charging after its account is gone.
  if (subscription && subscription.status !== 'CANCELED') {
    if (!process.env.STRIPE_SECRET_KEY) throw new DeletionError('Abonamentul nu a putut fi oprit. Contul nu a fost șters; încearcă din nou mai târziu.')
    try { await new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 8000, maxNetworkRetries: 0 }).subscriptions.cancel(subscription.stripeSubscriptionId) }
    catch (error: any) { if (error?.code !== 'resource_missing') throw new DeletionError('Abonamentul nu a putut fi oprit. Contul nu a fost șters; încearcă din nou.') }
  }
  if (contracts.length || periods.length || business.billingInvoiceUrl || business.billingPaidAt) {
    const billing = Object.fromEntries(Object.entries(business).filter(([key]) => key.startsWith('billing') || key === 'id'))
    const records = JSON.stringify({ encrypted: encrypt(JSON.stringify({ contracts, billing, periods, subscriptionId: subscription?.stripeSubscriptionId ?? null })) })
    const businessHash = accountHash(target.targetKey)
    await tx.$executeRaw`INSERT INTO "ClosedBusinessRecord" ("businessHash", "records") VALUES (${businessHash}, ${records}::jsonb)`
  }
  const [photos, documents, practitioners] = await Promise.all([
    tx.businessPhoto.findMany({ where: { businessId }, select: { url: true } }),
    tx.patientDocument.findMany({ where: { businessId }, select: { url: true } }),
    tx.practitioner.findMany({ where: { businessId }, select: { photoUrl: true } }),
  ])
  const urls = [business.heroImageUrl, ...photos.map(p => p.url), ...documents.map(d => d.url), ...practitioners.map(p => p.photoUrl)]
  const ownedUrls = urls.filter((value): value is string => {
    const key = r2Key(value)
    return Boolean(key && (key.startsWith(`public/businesses/${businessId}/`) || key.startsWith(`patients/${businessId}/`)))
  })
  for (const url of new Set(ownedUrls)) {
    const id = hashToken(url)
    await tx.$executeRaw`INSERT INTO "AccountFileDeletion" ("id", "url") VALUES (${id}, ${url}) ON CONFLICT ("id") DO NOTHING`
  }
  await revoke(tx, users.map(user => `user:${user.id}`))
  await tx.passwordResetToken.deleteMany({ where: { userId: { in: users.map(user => user.id) } } })
  await tx.pendingGoogleConnection.deleteMany({ where: { businessId } })
  await tx.pendingMetaConnection.deleteMany({ where: { businessId } })
  await tx.customerMergeArchive.deleteMany({ where: { businessId } })
  await tx.smsJob.deleteMany({ where: { businessId } })
  await tx.fitnessMember.deleteMany({ where: { businessId } })
  await tx.missedMessageAlert.deleteMany({ where: { businessId } })
  await tx.chatMessage.deleteMany({ where: { businessId } })
  await tx.messageTemplate.deleteMany({ where: { businessId } })
  await tx.supportTicket.deleteMany({ where: { businessId } })
  await tx.review.deleteMany({ where: { businessId } })
  await tx.blockedSlot.deleteMany({ where: { businessId } })
  await tx.businessPhoto.deleteMany({ where: { businessId } })
  await tx.conversation.deleteMany({ where: { businessId } })
  await tx.booking.deleteMany({ where: { businessId } })
  await tx.waitlistEntry.deleteMany({ where: { businessId } })
  await tx.googleCalendarConnection.deleteMany({ where: { businessId } })
  await tx.servicePractitioner.deleteMany({ where: { practitioner: { businessId } } })
  await tx.practitionerWorkingHours.deleteMany({ where: { practitioner: { businessId } } })
  await tx.practitioner.deleteMany({ where: { businessId } })
  await tx.patientDocument.deleteMany({ where: { businessId } })
  await tx.medicalLetter.deleteMany({ where: { businessId } })
  await tx.patientMedicalRecord.deleteMany({ where: { customer: { businessId } } })
  await tx.customer.deleteMany({ where: { businessId } })
  await tx.service.deleteMany({ where: { businessId } })
  await tx.resource.deleteMany({ where: { businessId } })
  await tx.staff.deleteMany({ where: { businessId } })
  await tx.workingHours.deleteMany({ where: { businessId } })
  await tx.channel.deleteMany({ where: { businessId } })
  await tx.subscription.deleteMany({ where: { businessId } })
  await tx.contractSignature.deleteMany({ where: { businessId } })
  await tx.user.updateMany({ where: { businessId, role: 'SUPER_ADMIN' }, data: { businessId: null } })
  await tx.user.deleteMany({ where: { businessId, role: { not: 'SUPER_ADMIN' } } })
  await tx.business.delete({ where: { id: businessId } })
}

export async function deleteAccount(target: DeletionTarget, token: string, confirmation: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || confirmation !== target.confirmation) throw new DeletionError('Textul de confirmare nu corespunde.', 400)
  await prisma.$transaction(async tx => {
    await consumeChallenge(tx, target, token)
    if (target.kind === 'CUSTOMER') await deletePersonal(tx, target)
    else await deleteBusiness(tx, target)
  }, { timeout: 60000, maxWait: 10000 })
}

export async function cleanupDeletedAccountFiles() {
  const deadline = Date.now() + 40000
  let deleted = 0
  const attempted: string[] = []
  while (Date.now() < deadline) {
    const jobs = await prisma.$queryRaw<{ id: string; url: string }[]>`SELECT "id", "url" FROM "AccountFileDeletion" WHERE NOT ("id" = ANY(${attempted}::text[])) ORDER BY "createdAt" LIMIT 100`
    if (!jobs.length) break
    for (let index = 0; index < jobs.length && Date.now() < deadline; index += 8) {
      await Promise.all(jobs.slice(index, index + 8).map(async job => {
        attempted.push(job.id)
        try {
          await deleteR2File(job.url)
          await prisma.$executeRaw`DELETE FROM "AccountFileDeletion" WHERE "id" = ${job.id}`
          deleted++
        } catch { console.error('[account-deletion] File cleanup deferred') }
      }))
    }
    if (attempted.length >= 10000) break
  }
  await prisma.$executeRaw`DELETE FROM "AccountDeletionChallenge" WHERE "expiresAt" < clock_timestamp()`
  return { deleted }
}
