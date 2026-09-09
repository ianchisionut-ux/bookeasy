import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { failure, FITNESS_COOKIE, hashToken, input, json, newToken, requireSameOrigin } from '@/lib/fitness-auth'

export async function POST(req: Request) {
  try {
    const { token } = await input(req, z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict())
    if (!rateLimit(`fitness-activate:${getClientIp(req)}`, 15, 15 * 60_000).allowed) return json({ error: 'Prea multe încercări. Încearcă peste 15 minute.' }, 429)
    const sessionToken = newToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000)
    const success = await prisma.$transaction(async tx => {
      const client = await tx.fitnessClient.findUnique({ where: { inviteHash: hashToken(token) }, include: { business: true } })
      if (!client || !client.active || !client.business.accountActive || client.business.category !== 'FITNESS') return false
      const consumed = await tx.fitnessClient.updateMany({
        where: { id: client.id, inviteHash: hashToken(token), inviteExpiresAt: { gt: new Date() } },
        data: { inviteHash: null, inviteExpiresAt: null },
      })
      if (consumed.count !== 1) return false
      await tx.fitnessSession.deleteMany({ where: { clientId: client.id, expiresAt: { lt: new Date() } } })
      await tx.fitnessSession.create({ data: { clientId: client.id, tokenHash: hashToken(sessionToken), expiresAt } })
      return true
    })
    if (!success) return json({ error: 'Link expirat sau deja folosit. Solicită unul nou instructorului.' }, 401)
    const response = json({ ok: true })
    response.cookies.set(FITNESS_COOKIE, sessionToken, { httpOnly: true, secure: new URL(req.url).protocol === 'https:', sameSite: 'strict', path: '/', expires: expiresAt })
    return response
  } catch (e) { return failure(e) }
}
export async function DELETE(req: Request) {
  try {
    requireSameOrigin(req)
    const token = (await cookies()).get(FITNESS_COOKIE)?.value
    if (token) await prisma.fitnessSession.deleteMany({ where: { tokenHash: hashToken(token) } })
    const response = json({ ok: true }); response.cookies.set(FITNESS_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (e) { return failure(e) }
}
