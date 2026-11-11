import { prisma } from '@/lib/prisma'

import { assertMetaAccountAvailable, saveMetaAccounts, MetaConnectionError } from '@/lib/business-meta'

export class MetaOnboardingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export async function connectMetaWhatsApp({
  businessId,
  code,
  wabaId,
  phoneNumberId,
}: {
  businessId: string
  code: string
  wabaId: string
  phoneNumberId: string
}) {
  if (!(await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }))) {
    throw new MetaOnboardingError('Afacerea nu există.', 404)
  }

  const tokenResponse = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      code,
    }),
  })
  const tokenData = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new MetaOnboardingError(tokenData.error?.message ?? 'Meta nu a returnat tokenul WhatsApp.')
  }

  const phonesResponse = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  )
  const phones = await phonesResponse.json()
  if (!phonesResponse.ok || !phones.data?.some((phone: { id: string }) => phone.id === phoneNumberId)) {
    throw new MetaOnboardingError(phones.error?.message ?? 'Numărul WhatsApp nu aparține contului autorizat.')
  }

  try { await assertMetaAccountAvailable(businessId, 'WHATSAPP', phoneNumberId) }
  catch (error) { throw new MetaOnboardingError(error instanceof MetaConnectionError ? error.message : 'Contul WhatsApp nu poate fi verificat.', 409) }

  const subscribeResponse = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(wabaId)}/subscribed_apps`,
    { method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  )
  const subscription = await subscribeResponse.json()
  if (!subscribeResponse.ok || subscription.success === false) {
    throw new MetaOnboardingError(subscription.error?.message ?? 'Abonarea webhook-ului WhatsApp a eșuat.')
  }

  const phone = phones.data.find((item: { id: string }) => item.id === phoneNumberId)
  try {
    await saveMetaAccounts(businessId, [{ type: 'WHATSAPP', externalId: phoneNumberId, wabaId, displayName: phone?.display_phone_number ?? phoneNumberId, accessToken: tokenData.access_token, authProvider: 'meta', expiresAt: Number(tokenData.expires_in) > 0 ? new Date(Date.now() + Number(tokenData.expires_in) * 1000) : null }])
  } catch (error) { throw new MetaOnboardingError(error instanceof MetaConnectionError ? error.message : 'Conexiunea WhatsApp nu a putut fi salvată.', 409) }
  return { phone: phone?.display_phone_number ?? phoneNumberId }
}
