import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ZodError, type ZodType } from 'zod'

export const FITNESS_COOKIE = 'bookeasy-fitness-session'
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex')
export const newToken = () => randomBytes(32).toString('hex')
export class FitnessError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function instructor() {
  const session = await auth()
  const userId = (session as any)?.userId as string | undefined
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, include: { business: true } }) : null
  // Only the business owner manages these sensitive client plans. No new access for STAFF.
  if (!user || user.role !== 'OWNER' || user.business?.category !== 'FITNESS' || !user.business.accountActive) {
    throw new FitnessError(403, 'Acces rezervat instructorului unei afaceri Fitness active.')
  }
  return user.business
}
export async function portalClient() {
  const token = (await cookies()).get(FITNESS_COOKIE)?.value
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new FitnessError(401, 'Solicită instructorului un link de acces nou.')
  const session = await prisma.fitnessSession.findUnique({
    where: { tokenHash: hashToken(token) }, include: { client: { include: { business: true, customer: true } } },
  })
  if (!session || session.expiresAt <= new Date() || !session.client.active || !session.client.business.accountActive || session.client.business.category !== 'FITNESS') {
    throw new FitnessError(401, 'Accesul a expirat sau a fost revocat. Contactează instructorul.')
  }
  return session.client
}
export async function fitnessActor(req: Request) {
  const owner = new URL(req.url).searchParams.get('mode') === 'instructor'
  if (!owner) {
    const client = await portalClient()
    return { client, owner: false }
  }
  const business = await instructor()
  const id = new URL(req.url).searchParams.get('clientId') ?? ''
  const client = await prisma.fitnessClient.findFirst({ where: { id, businessId: business.id }, include: { customer: true, business: true } })
  if (!client) throw new FitnessError(404, 'Client inexistent.')
  return { client, owner: true }
}
export function requireSameOrigin(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) throw new FitnessError(403, 'Cerere nepermisă.')
}
export async function input<T>(req: Request, schema: ZodType<T>): Promise<T> {
  requireSameOrigin(req)
  if (!req.headers.get('content-type')?.includes('application/json')) throw new FitnessError(415, 'Format invalid.')
  const reader = req.body?.getReader()
  if (!reader) throw new FitnessError(400, 'Lipsesc datele.')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.length
    if (size > 32768) { await reader.cancel(); throw new FitnessError(413, 'Conținut prea mare.') }
    chunks.push(value)
  }
  try { return schema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
  catch (e) { if (e instanceof ZodError) throw e; throw new FitnessError(400, 'Date invalide.') }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
}
export function failure(error: unknown) {
  if (error instanceof FitnessError) return json({ error: error.message }, error.status)
  if (error instanceof ZodError) return json({ error: 'Verifică datele completate.' }, 400)
  // Never log nutrition details, messages, sessions or invite tokens.
  console.error('Fitness request failed', error instanceof Error ? error.name : 'unknown')
  return json({ error: 'Cererea nu a putut fi finalizată. Încearcă din nou.' }, 500)
}
