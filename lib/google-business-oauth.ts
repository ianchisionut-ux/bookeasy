// Business Profile can use an approved Cloud project independently of Google sign-in/Calendar.
export function googleBusinessCredentials() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim()
  if (clientId || clientSecret) return clientId && clientSecret ? { clientId, clientSecret } : null
  return legacyCredentials()
}

function legacyCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export class GoogleBusinessConnectionError extends Error {
  constructor(public stage: string, message: string, public status?: number, public reason?: string) { super(message) }
}

export async function refreshGoogleBusinessToken(refreshToken: string) {
  const primary = googleBusinessCredentials()
  if (!primary) throw new GoogleBusinessConnectionError('configuration', 'Conectarea Google Business Profile nu este configurată complet. Contactează echipa BookEasy.')
  const legacy = legacyCredentials()
  const credentials = legacy && legacy.clientId !== primary.clientId ? [primary, legacy] : [primary]
  for (let index = 0; index < credentials.length; index++) {
    const config = credentials[index]
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    const token = await response.json().catch(() => null)
    if (response.ok && token?.access_token && Number(token.expires_in) > 0) return token as { access_token: string; expires_in: number }
    // Older connections remain bound to the former OAuth client. Never retry a quota/server failure.
    if (index + 1 < credentials.length && ['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(token?.error)) continue
    throw new GoogleBusinessConnectionError('refresh', 'Accesul Google Business Profile trebuie reconectat din Setări.', response.status, 'refresh_rejected')
  }
  throw new GoogleBusinessConnectionError('refresh', 'Reia conectarea Google Business Profile din Setări.')
}
