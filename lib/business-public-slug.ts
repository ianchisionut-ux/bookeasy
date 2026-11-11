import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { publicSlugFromName } from './public-slug'
import { permanentRedirect } from 'next/navigation'

export async function redirectPublicAlias(slug: string, suffix: string, query: Record<string, string | string[] | undefined>) {
  const canonical = await resolvePublicSlug(slug)
  if (canonical === slug) return
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach(item => params.append(key, item))
    else if (value !== undefined) params.set(key, value)
  }
  permanentRedirect(`/${canonical}${suffix}${params.size ? '?' + params.toString() : ''}`)
}

export async function ensureReadablePublicSlug(businessId: string) {
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(21420261031::bigint)`
    const business = await tx.business.findUnique({ where: { id: businessId }, select: { slug: true, name: true, onboardingDone: true } })
    if (business?.onboardingDone && business.name !== 'Afacerea mea' && /-[a-f0-9]{12}$/.test(business.slug)) await setPublicSlug(tx, businessId, business.name, true)
  })
}

export async function resolvePublicSlug(slug: string) {
  const alias = await prisma.businessSlugAlias.findUnique({ where: { slug }, select: { business: { select: { slug: true } } } })
  return alias?.business.slug ?? slug
}

export async function setPublicSlug(tx: Prisma.TransactionClient, businessId: string, requested: string, auto = false) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(21420261031::bigint)`
  const business = await tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { slug: true } })
  const base = auto ? publicSlugFromName(requested) : requested
  let slug = base
  for (let index = 2; ; index++) {
    const [current, alias] = await Promise.all([
      tx.business.findUnique({ where: { slug }, select: { id: true } }),
      tx.businessSlugAlias.findUnique({ where: { slug }, select: { businessId: true } }),
    ])
    if ((!current || current.id === businessId) && (!alias || alias.businessId === businessId)) break
    if (!auto) return null
    slug = `${base}-${index}`
  }
  if (slug !== business.slug) {
    await tx.businessSlugAlias.deleteMany({ where: { slug, businessId } })
    await tx.businessSlugAlias.upsert({ where: { slug: business.slug }, create: { slug: business.slug, businessId }, update: {} })
    await tx.business.update({ where: { id: businessId }, data: { slug } })
  }
  return slug
}
