import { encrypt } from '@/lib/crypto'
import { assertChannelOwnership, saveBusinessChannel } from '@/lib/business-channel-connection'

export const INSTAGRAM_GRAPH = 'https://graph.instagram.com/v26.0'
export const INSTAGRAM_SCOPE = 'instagram_business_basic,instagram_business_manage_messages'

export function instagramLoginConfigured() {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
}

async function instagramRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || data.error || data.error_message) {
    throw new Error(data.error?.message ?? data.error_message ?? 'Instagram a respins conectarea.')
  }
  return data
}

export async function connectInstagram(businessId: string, code: string, redirectUri: string) {
  const form = new FormData()
  form.set('client_id', process.env.INSTAGRAM_APP_ID!)
  form.set('client_secret', process.env.INSTAGRAM_APP_SECRET!)
  form.set('grant_type', 'authorization_code')
  form.set('redirect_uri', redirectUri)
  form.set('code', code)
  const shortResponse = await instagramRequest('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })
  const shortToken = shortResponse.data?.[0] ?? shortResponse
  if (!shortToken.access_token) throw new Error('Instagram nu a returnat tokenul de acces.')
  if (shortToken.permissions) {
    const granted = Array.isArray(shortToken.permissions) ? shortToken.permissions : shortToken.permissions.split(',')
    if (!INSTAGRAM_SCOPE.split(',').every((scope) => granted.includes(scope))) throw new Error('Acordă acces la profil și mesaje pentru a conecta Instagram.')
  }
  const exchangeUrl = new URL('https://graph.instagram.com/access_token')
  exchangeUrl.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: process.env.INSTAGRAM_APP_SECRET!, access_token: shortToken.access_token }).toString()
  const token = await instagramRequest(exchangeUrl.toString())
  if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('Instagram nu a returnat un token de lungă durată valid.')
  const headers = { Authorization: `Bearer ${token.access_token}` }
  const profileResponse = await instagramRequest(`${INSTAGRAM_GRAPH}/me?fields=user_id,username`, { headers })
  const profile = profileResponse.data?.[0] ?? profileResponse
  // user_id is the professional account ID used in webhook entry.id; id is app-scoped.
  const externalId = String(profile.user_id ?? '')
  if (!/^\d+$/.test(externalId)) throw new Error('Instagram nu a returnat ID-ul contului profesional.')
  await assertChannelOwnership(businessId, 'INSTAGRAM', externalId)
  const subscribed = await instagramRequest(`${INSTAGRAM_GRAPH}/${externalId}/subscribed_apps`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ subscribed_fields: 'messages,messaging_postbacks' }),
  })
  if (subscribed.success !== true) throw new Error('Abonarea contului Instagram la mesaje a eșuat.')
  await saveBusinessChannel(businessId, 'INSTAGRAM', externalId, {
    accessToken: encrypt(token.access_token), authProvider: 'instagram', expiresAt: new Date(Date.now() + token.expires_in * 1000),
  })
}

export async function refreshInstagramToken(encryptedToken: string) {
  const { decrypt } = await import('@/lib/crypto')
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.search = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: decrypt(encryptedToken) }).toString()
  const token = await instagramRequest(url.toString())
  if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('Tokenul Instagram nu a putut fi reînnoit.')
  return { accessToken: encrypt(token.access_token), expiresAt: new Date(Date.now() + token.expires_in * 1000), status: 'ACTIVE' as const }
}
