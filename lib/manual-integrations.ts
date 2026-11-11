import { z } from 'zod'
import { INSTAGRAM_GRAPH } from './instagram-login'

export const manualChannelSchema = z.object({
  type: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS']),
  externalId: z.string().trim().min(1).max(500),
  displayName: z.string().trim().max(200).default(''),
  accessToken: z.string().trim().max(20000).optional(),
  refreshToken: z.string().trim().max(20000).optional(),
  wabaId: z.string().trim().max(100).optional(),
  authProvider: z.enum(['meta', 'instagram']).optional(),
  expiresInMinutes: z.number().int().min(1).max(525600).default(60),
}).superRefine((value, ctx) => {
  if (value.type !== 'GOOGLE_BUSINESS' && !/^\d{5,}$/.test(value.externalId)) ctx.addIssue({ code: 'custom', message: 'ID-ul trebuie să conțină numai cifre.', path: ['externalId'] })
  if (value.type === 'GOOGLE_BUSINESS' && !/^accounts\/\d+\/locations\/\d+$/.test(value.externalId)) ctx.addIssue({ code: 'custom', message: 'Resursa locației Google nu este validă.', path: ['externalId'] })
  if (value.type === 'WHATSAPP' && !/^\d{5,}$/.test(value.wabaId || '')) ctx.addIssue({ code: 'custom', message: 'WABA ID este obligatoriu.', path: ['wabaId'] })
})

export async function integrationRequest(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error || data.success === false) throw new Error(`Furnizorul a respins tokenul, ID-ul sau permisiunile (HTTP ${response.status}).`)
  return data
}

export async function verifyManualChannel(input: z.infer<typeof manualChannelSchema>, token: string) {
  const graph = 'https://graph.facebook.com/v21.0'
  if (input.type === 'GOOGLE_BUSINESS') {
    await integrationRequest(`https://mybusiness.googleapis.com/v4/${input.externalId}/reviews?pageSize=1`, token)
    return { authProvider: 'google', displayName: input.displayName }
  }
  const instagram = input.type === 'INSTAGRAM' && input.authProvider !== 'meta'
  const base = instagram ? INSTAGRAM_GRAPH : graph
  const profile = await integrationRequest(instagram ? `${base}/me?fields=user_id,username` : `${base}/${input.externalId}?fields=id`, token)
  const resolvedId = String(instagram ? (profile.data?.[0] ?? profile).user_id : profile.id)
  if (resolvedId !== input.externalId) throw new Error('Tokenul nu corespunde contului / ID-ului introdus.')
  if (input.type === 'WHATSAPP') {
    const numbers = await integrationRequest(`${graph}/${input.wabaId}/phone_numbers?fields=id&limit=100`, token)
    if (!numbers.data?.some((number: { id: string }) => number.id === input.externalId)) throw new Error('Numărul WhatsApp nu aparține contului WABA introdus.')
    const subscribed = await integrationRequest(`${graph}/${input.wabaId}/subscribed_apps`, token, { method: 'POST' })
    if (subscribed.success !== true) throw new Error('Meta nu a confirmat abonarea WhatsApp.')
  } else {
    const fields = input.type === 'FACEBOOK' ? 'messages,messaging_postbacks,message_deliveries,message_reads' : 'messages,messaging_postbacks'
    const subscribed = await integrationRequest(`${base}/${input.externalId}/subscribed_apps`, token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ subscribed_fields: fields }) })
    if (subscribed.success !== true) throw new Error('Meta nu a confirmat abonarea canalului.')
  }
  return { authProvider: instagram ? 'instagram' : 'meta', displayName: input.displayName || (instagram ? String((profile.data?.[0] ?? profile).username || '') : '') }
}
