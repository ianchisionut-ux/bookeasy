const READ_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'])
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', '57P01', '57P02', '57P03', '08000', '08001', '08003', '08006'])

export function isTransientDatabaseError(error: unknown): boolean {
  const pending: unknown[] = [error]
  const seen = new Set<unknown>()
  for (let index = 0; index < pending.length && index < 12; index++) {
    const item = pending[index]
    if (!item || typeof item !== 'object' || seen.has(item)) continue
    seen.add(item)
    const value = item as { code?: string; message?: string; cause?: unknown; originalError?: unknown; meta?: { driverAdapterError?: unknown } }
    if (typeof value.code === 'string' && TRANSIENT_CODES.has(value.code)) return true
    if (typeof value.message === 'string' && /endpoint is taking longer than expected to become active|couldn't connect to compute node|can't reach database server|connection (?:terminated unexpectedly|closed unexpectedly)|timeout exceeded when trying to connect/i.test(value.message)) return true
    pending.push(value.cause, value.originalError, value.meta?.driverAdapterError)
  }
  return false
}

export async function retryDatabaseRead<T>(operation: string, query: () => Promise<T>, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  // Raw SQL can consume tokens, update counters or send work. Never replay it,
  // model writes, or an entire transaction after an uncertain connection result.
  if (!READ_OPERATIONS.has(operation)) return query()
  const delays = [750, 1500]
  for (let attempt = 0; ; attempt++) {
    try { return await query() } catch (error) {
      if (attempt >= delays.length || !isTransientDatabaseError(error)) throw error
      console.warn('[database] Retrying transient read', { operation, attempt: attempt + 1 })
      await wait(delays[attempt])
    }
  }
}
