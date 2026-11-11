import { GoogleBusinessConnectionError } from './google-business-oauth'
import { prisma } from './prisma'
import { ChannelOwnershipError } from './business-channel-connection'

export type GoogleLocation = { id: string; title: string; account: string }

async function getList(url: string, token: string, field: 'accounts' | 'locations') {
  const items: any[] = []
  let pageToken = ''
  for (let page = 0; page < 50; page++) {
    const target = new URL(url)
    if (pageToken) target.searchParams.set('pageToken', pageToken)
    const response = await fetch(target, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data || data.error) {
      const reasons = (data?.error?.details ?? []).map((detail: any) => detail?.reason)
      const reason = response.status === 429 ? 'quota'
        : reasons.includes('SERVICE_DISABLED') ? 'api_disabled'
        : response.status === 403 ? 'permission_denied' : 'provider_rejected'
      const message = reason === 'quota' ? 'Google Business Profile nu permite momentan cereri pentru proiectul configurat. Echipa BookEasy trebuie să verifice aprobarea API și cota din Google Cloud.'
        : reason === 'api_disabled' ? 'API-ul Google Business Profile nu este activat în proiectul configurat. Contactează echipa BookEasy.'
        : reason === 'permission_denied' ? 'Google a refuzat accesul la Business Profile. Verifică permisiunile contului și aprobarea proiectului Google Cloud.'
        : 'Google nu a putut încărca locațiile afacerii. Reîncearcă mai târziu.'
      throw new GoogleBusinessConnectionError(field, message, response.status, reason)
    }
    items.push(...(data[field] ?? []))
    pageToken = data.nextPageToken ?? ''
    if (!pageToken) return items
  }
  throw new GoogleBusinessConnectionError(field, 'Contul are prea multe locații pentru această conectare. Contactează suportul.')
}

export async function listGoogleLocations(token: string): Promise<GoogleLocation[]> {
  const accounts = await getList('https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20', token, 'accounts')
  const locations: GoogleLocation[] = []
  for (const account of accounts) {
    if (!/^accounts\/\d+$/.test(account.name)) continue
    const rows = await getList(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title&pageSize=100`, token, 'locations')
    for (const location of rows) {
      if (!/^locations\/\d+$/.test(location.name)) continue
      locations.push({ id: `${account.name}/${location.name}`, title: location.title || location.name, account: account.accountName || account.name })
    }
  }
  return locations
}

// Tokens remain encrypted on the server. A pending selection is consumed once.
export async function selectGoogleLocation(id: string, userId: string, businessId: string, locationId: string) {
  return prisma.$transaction(async tx => {
    const pending = await tx.pendingGoogleConnection.findFirst({ where: { id, userId, businessId, expiresAt: { gt: new Date() } } })
    if (!pending || !(pending.locations as unknown as GoogleLocation[]).some(item => item.id === locationId)) throw new Error('Alegerea a expirat. Reia conectarea Google.')
    const claim = await tx.pendingGoogleConnection.deleteMany({ where: { id, userId, businessId } })
    if (claim.count !== 1) throw new Error('Conectarea a fost deja finalizată.')
    const existing = await tx.channel.findUnique({ where: { type_externalId: { type: 'GOOGLE_BUSINESS', externalId: locationId } } })
    if (existing && existing.businessId !== businessId) throw new ChannelOwnershipError()
    const data = { accessToken: pending.accessToken, refreshToken: pending.refreshToken, expiresAt: pending.tokenExpiresAt, authProvider: 'google', status: 'ACTIVE' as const, enabledByOwner: true }
    if (existing) await tx.channel.update({ where: { id: existing.id }, data })
    else await tx.channel.create({ data: { businessId, type: 'GOOGLE_BUSINESS', externalId: locationId, ...data } })
    await tx.channel.updateMany({ where: { businessId, type: 'GOOGLE_BUSINESS', externalId: { not: locationId } }, data: { status: 'DISCONNECTED', enabledByOwner: false } })
    return pending.redirectTo
  })
}
