export const ARRIVAL_STORAGE_KEY = 'bookeasy_arrivals_v1'
export const ARRIVAL_CHANGED_EVENT = 'bookeasy:arrivals-changed'

export type ClientArrival = {
  bookingId: string
  token: string
  startAt: string
}

export function readClientArrivals(): ClientArrival[] {
  try {
    const value = JSON.parse(localStorage.getItem(ARRIVAL_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is ClientArrival =>
      typeof item?.bookingId === 'string' && typeof item?.token === 'string' &&
      typeof item?.startAt === 'string' && Number.isFinite(Date.parse(item.startAt)))
  } catch {
    return []
  }
}

export function writeClientArrivals(entries: ClientArrival[]) {
  localStorage.setItem(ARRIVAL_STORAGE_KEY, JSON.stringify(entries))
  window.dispatchEvent(new Event(ARRIVAL_CHANGED_EVENT))
}
