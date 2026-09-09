import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { failure, hashToken, input, instructor, json, newToken } from '@/lib/fitness-auth'

export async function GET() {
  try {
    const business = await instructor()
    const customers = await prisma.customer.findMany({
      where: { businessId: business.id }, orderBy: { name: 'asc' }, take: 1000,
      select: { id: true, name: true, fitnessClient: { select: { id: true, active: true } } },
    })
    return json({ customers })
  } catch (e) { return failure(e) }
}
export async function POST(req: Request) {
  try {
    const business = await instructor()
    const { customerId, action } = await input(req, z.object({ customerId: z.string().min(1), action: z.enum(['invite', 'revoke']) }).strict())
    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: business.id } })
    if (!customer) return json({ error: 'Client inexistent.' }, 404)
    if (action === 'revoke') {
      await prisma.$transaction(async tx => {
        const client = await tx.fitnessClient.findUnique({ where: { customerId } })
        if (!client) return
        await tx.fitnessClient.update({ where: { id: client.id }, data: { active: false, inviteHash: null, inviteExpiresAt: null } })
        await tx.fitnessSession.deleteMany({ where: { clientId: client.id } })
      })
      return json({ ok: true })
    }
    const token = newToken()
    const expiresAt = new Date(Date.now() + 24 * 3600_000)
    const client = await prisma.fitnessClient.upsert({
      where: { customerId },
      create: { customerId, businessId: business.id, inviteHash: hashToken(token), inviteExpiresAt: expiresAt },
      update: { active: true, inviteHash: hashToken(token), inviteExpiresAt: expiresAt },
    })
    // Fragment never reaches HTTP logs or referrer headers. User explicitly redeems via POST.
    return json({ clientId: client.id, inviteUrl: `${new URL(req.url).origin}/fitness/activate#${token}`, expiresAt })
  } catch (e) { return failure(e) }
}
