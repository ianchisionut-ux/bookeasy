import { prisma } from './prisma'
import type { Session } from 'next-auth'

export type ClientProfileData = { firstName: string; lastName: string; email: string; phone: string }

export function splitClientName(name: string) {
  const [firstName = '', ...parts] = name.trim().split(/\s+/)
  return { firstName, lastName: parts.join(' ') }
}

export function clientIdentity(session: Session | null) {
  const details = session as (Session & { role?: string; googleSub?: string; userId?: string; firstName?: string; lastName?: string; customerPhone?: string }) | null
  if (details?.role !== 'CUSTOMER' || !details.user?.email) return null
  const ownerKey = details.googleSub ? `google:${details.googleSub}` : details.userId ? `user:${details.userId}` : null
  if (!ownerKey) return null
  const fallback = splitClientName(details.user.name ?? '')
  return {
    ownerKey,
    firstName: details.firstName || fallback.firstName,
    lastName: details.lastName || fallback.lastName,
    email: details.user.email,
    phone: details.customerPhone ?? '',
    googleSub: details.googleSub ?? null,
  }
}

export async function getClientProfile(session: Session | null): Promise<ClientProfileData | null> {
  const identity = clientIdentity(session)
  if (!identity) return null
  const saved = await prisma.clientProfile.findUnique({ where: { ownerKey: identity.ownerKey } })
  const previous = !saved?.phone && !identity.phone && identity.googleSub ? await prisma.booking.findFirst({
    where: { reviewerGoogleSub: identity.googleSub },
    orderBy: { startAt: 'desc' },
    select: { customer: { select: { phone: true } } },
  }) : null
  return {
    firstName: saved?.firstName ?? identity.firstName,
    lastName: saved?.lastName ?? identity.lastName,
    email: identity.email,
    phone: saved?.phone || identity.phone || previous?.customer.phone || '',
  }
}

export async function saveBookingClientProfile(identity: NonNullable<ReturnType<typeof clientIdentity>>, name: string, phone: string) {
  const current = await prisma.clientProfile.findUnique({ where: { ownerKey: identity.ownerKey } })
  const source = current ?? identity
  const fullName = [source.firstName, source.lastName].filter(Boolean).join(' ')
  const names = name.trim() === fullName ? { firstName: source.firstName, lastName: source.lastName } : splitClientName(name)
  const data = { ...names, email: identity.email, phone }
  return prisma.clientProfile.upsert({ where: { ownerKey: identity.ownerKey }, create: { ownerKey: identity.ownerKey, ...data }, update: data })
}
