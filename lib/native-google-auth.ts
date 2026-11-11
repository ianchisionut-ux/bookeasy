import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma'

export const NATIVE_GOOGLE_TTL_MS = 5 * 60 * 1000
export const NATIVE_GOOGLE_COOKIE = '__Secure-bookeasy-native-google'
export type NativeGoogleIdentity = { googleSub: string; email: string; firstName: string; lastName: string; customerPhone: string; name: string }
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{48}$/.test(id)
const validProof = (proof: unknown): proof is string => typeof proof === 'string' && /^[a-f0-9]{64}$/.test(proof)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export async function createNativeGoogleFlow(challenge: unknown) {
  if (!validProof(challenge)) return null
  const id = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + NATIVE_GOOGLE_TTL_MS)
  await prisma.$executeRaw`DELETE FROM "NativeGoogleFlow" WHERE "expiresAt" < NOW()`
  await prisma.$executeRaw`INSERT INTO "NativeGoogleFlow" ("id", "challenge", "expiresAt") VALUES (${id}, ${challenge}, ${expiresAt})`
  return { id, expiresAt: expiresAt.getTime() }
}

export async function nativeGoogleFlowExists(id: unknown) {
  if (!validId(id)) return false
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "NativeGoogleFlow" WHERE "id" = ${id} AND "expiresAt" > NOW() AND "payload" IS NULL`
  return rows.length === 1
}

export async function nativeGoogleFlowStatus(id: unknown, verifier: unknown) {
  if (!validId(id) || !validProof(verifier)) return { ready: false, expired: true }
  const challenge = hash(verifier)
  const rows = await prisma.$queryRaw<{ ready: boolean }[]>`SELECT ("payload" IS NOT NULL) AS "ready" FROM "NativeGoogleFlow" WHERE "id" = ${id} AND "challenge" = ${challenge} AND "expiresAt" > NOW()`
  return { ready: rows[0]?.ready === true, expired: rows.length === 0 }
}

export function nativeGoogleIdentity(session: any): NativeGoogleIdentity | null {
  if (!['CUSTOMER', 'OWNER', 'STAFF', 'SUPER_ADMIN'].includes(session?.role) || typeof session.googleSub !== 'string' || !session.googleSub
    || typeof session.user?.email !== 'string' || !session.user.email) return null
  return {
    googleSub: session.googleSub, email: session.user.email,
    firstName: typeof session.firstName === 'string' ? session.firstName : '',
    lastName: typeof session.lastName === 'string' ? session.lastName : '',
    customerPhone: typeof session.customerPhone === 'string' ? session.customerPhone : '',
    name: typeof session.user.name === 'string' ? session.user.name : '',
  }
}

export async function completeNativeGoogleFlow(id: unknown, session: unknown) {
  const identity = nativeGoogleIdentity(session)
  if (!validId(id) || !identity) return false
  const payload = JSON.stringify(identity)
  const count = await prisma.$executeRaw`UPDATE "NativeGoogleFlow" SET "payload" = ${payload}::jsonb WHERE "id" = ${id} AND "expiresAt" > NOW() AND "payload" IS NULL`
  return count === 1
}

export async function consumeNativeGoogleFlow(id: unknown, verifier: unknown) {
  if (!validId(id) || !validProof(verifier)) return null
  const challenge = hash(verifier)
  // One atomic statement: parallel or replayed redemption cannot create a second session.
  const rows = await prisma.$queryRaw<{ payload: NativeGoogleIdentity }[]>`DELETE FROM "NativeGoogleFlow" WHERE "id" = ${id} AND "challenge" = ${challenge} AND "expiresAt" > NOW() AND "payload" IS NOT NULL RETURNING "payload"`
  const identity = rows[0]?.payload
  if (!identity || typeof identity.googleSub !== 'string' || !identity.googleSub || typeof identity.email !== 'string' || !identity.email) return null
  return { ...identity, id: `google:${identity.googleSub}`, role: 'CUSTOMER', businessId: null }
}
