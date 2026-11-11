// Browser permission is authoritative. Automatic reads must never trigger a prompt.
const POSITION_KEY = 'bookeasy-client-location-v1'
export type ClientPosition = { latitude: number; longitude: number }
let cached: ClientPosition | null = null
let pending: Promise<GeolocationPosition | null> | null = null
let deniedSinceUserAction = false

function savedPosition(): ClientPosition | null {
  if (cached) return cached
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null')
    if (value && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
      && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180) cached = value
  } catch { /* Storage may be unavailable. */ }
  return cached
}

export async function canReadLocationWithoutPrompt(): Promise<boolean> {
  try {
    if (deniedSinceUserAction) return false
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return false
    return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'
  } catch { return false }
}

// Share the whole request, including the permission check, across client components.
// Precise arrival coordinates remain in memory; only approximate coordinates are saved.
export function requestClientPosition(userInitiated = false, options: PositionOptions = {}): Promise<GeolocationPosition | null> {
  if (pending) return pending
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  if (userInitiated) deniedSinceUserAction = false
  const request = async () => {
    if (!userInitiated && (deniedSinceUserAction || !await canReadLocationWithoutPrompt())) return null
    return new Promise<GeolocationPosition | null>((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            cached = {
              latitude: Math.round(position.coords.latitude * 100) / 100,
              longitude: Math.round(position.coords.longitude * 100) / 100,
            }
            try { localStorage.setItem(POSITION_KEY, JSON.stringify(cached)) } catch { /* Keep in memory. */ }
            resolve(position)
          },
          (error) => {
            if (error.code === 1) deniedSinceUserAction = true
            resolve(null)
          },
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000, ...options },
        )
      } catch { resolve(null) }
    })
  }
  pending = request().catch(() => null).finally(() => { pending = null })
  return pending
}

export async function getClientLocation(userInitiated = false): Promise<ClientPosition | null> {
  if (!userInitiated) {
    const saved = savedPosition()
    if (saved) return saved
  }
  const position = await requestClientPosition(userInitiated)
  return position ? savedPosition() : null
}

