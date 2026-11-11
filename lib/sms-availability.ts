export function platformSmsReady(gateway: { enabled: boolean; phone: string | null | undefined; lastSeenAt: Date | null | undefined } | null, now = Date.now()) {
  return Boolean(gateway?.enabled && gateway.phone?.trim() && gateway.lastSeenAt && now - gateway.lastSeenAt.getTime() >= 0 && now - gateway.lastSeenAt.getTime() < 120_000)
}
