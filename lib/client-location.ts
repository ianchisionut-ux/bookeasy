import { ROMANIAN_CITY_COORDINATES } from './romanian-city-coordinates'
import { normalizeCity } from './romanian-cities'

// City centers are approximate. Only select a city when the device is close
// enough to it; otherwise keep the unrestricted marketplace view.
export function cityNearLocation(latitude: number, longitude: number, availableCities: readonly string[]): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  let nearest: string | null = null
  let nearestKm = Infinity
  const latitudeRadians = latitude * Math.PI / 180

  for (const [name, cityLatitude, cityLongitude] of ROMANIAN_CITY_COORDINATES) {
    const dLat = (latitude - cityLatitude) * Math.PI / 180
    const dLon = (longitude - cityLongitude) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(latitudeRadians) * Math.cos(cityLatitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    if (distanceKm < nearestKm) {
      nearest = name
      nearestKm = distanceKm
    }
  }

  if (!nearest || nearestKm > 15) return null
  return availableCities.find((city) => normalizeCity(city) === normalizeCity(nearest)) ?? null
}
