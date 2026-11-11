export function isBookingConflict(error: unknown): boolean {
  const value = error as { message?: string; meta?: unknown }
  return `${value?.message ?? ''} ${JSON.stringify(value?.meta ?? {})}`.includes('BOOKEASY_SLOT_CONFLICT')
}
