import { PUBLIC_CATEGORIES } from './business-categories'
import { canonicalCity } from './romanian-cities'

export const publicMarketplaceWhere = {
  publicListed: true,
  accountActive: true,
  category: { in: [...PUBLIC_CATEGORIES] },
}

export function withoutDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function publicCitySlug(value: string) {
  return withoutDiacritics(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function publicCityPath(slug: string) {
  return `/descopera/${slug}`
}

export function publicCity(value: string | null) {
  if (!value?.trim()) return null
  const name = withoutDiacritics(canonicalCity(value) ?? value.trim())
  const slug = publicCitySlug(name)
  return slug ? { slug, name } : null
}

export function publicCities(rows: ReadonlyArray<{ city: string | null }>) {
  const cities = new Map<string, { slug: string; name: string; databaseNames: Set<string> }>()
  for (const { city } of rows) {
    if (!city) continue
    const location = publicCity(city)
    if (!location) continue
    const existing = cities.get(location.slug)
    if (existing) existing.databaseNames.add(city)
    else cities.set(location.slug, { ...location, databaseNames: new Set([city]) })
  }
  return [...cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
}
