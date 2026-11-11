export async function geocodeAddress(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GEOAPIFY_API_KEY
  if (!key || !city.trim()) return null

  const url = new URL('https://api.geoapify.com/v1/geocode/search')
  url.search = new URLSearchParams({
    text: [address.trim(), city.trim(), 'România'].filter(Boolean).join(', '),
    filter: 'countrycode:ro', format: 'json', lang: 'ro', limit: '1', apiKey: key,
  }).toString()

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json()
    const { lat, lon: lng } = data.results?.[0] ?? {}
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat, lng }
  } catch {
    // Keep settings usable when the provider is unavailable; never log the key-bearing URL.
    return null
  }
}
