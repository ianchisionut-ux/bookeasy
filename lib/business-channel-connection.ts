import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export class ChannelOwnershipError extends Error {
  constructor() {
    super('Acest cont este deja conectat la altă afacere BookEasy. Deconectează-l prin administratorul platformei înainte de a-l transfera.')
  }
}

export async function assertChannelOwnership(businessId: string, type: ChannelType, externalId: string) {
  const existing = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId } }, select: { businessId: true } })
  if (existing && existing.businessId !== businessId) throw new ChannelOwnershipError()
}

// Never update businessId on reconnection, including when two callbacks race.
export async function saveBusinessChannel(businessId: string, type: ChannelType, externalId: string, data: {
  accessToken: string; authProvider: string; expiresAt?: Date | null; refreshToken?: string; wabaId?: string
}) {
  await assertChannelOwnership(businessId, type, externalId)
  const update = { ...data, status: 'ACTIVE' as const, enabledByOwner: true }
  const changed = await prisma.channel.updateMany({ where: { businessId, type, externalId }, data: update })
  if (changed.count) return
  try {
    await prisma.channel.create({ data: { businessId, type, externalId, ...update } })
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError).code !== 'P2002') throw error
    const retry = await prisma.channel.updateMany({ where: { businessId, type, externalId }, data: update })
    if (!retry.count) throw new ChannelOwnershipError()
  }
}
