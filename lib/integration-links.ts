export function integrationUrl(path: string, businessId?: string) {
  if (!businessId) return path
  const url = new URL(path, 'https://bookeasy.invalid')
  url.searchParams.set('businessId', businessId)
  return url.pathname + url.search
}
