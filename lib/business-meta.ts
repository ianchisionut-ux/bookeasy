import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

export const FACEBOOK_GRAPH = 'https://graph.facebook.com/v21.0'
export const INSTAGRAM_GRAPH = 'https://graph.instagram.com/v26.0'
export type MetaChannelChoice = 'messenger' | 'instagram' | 'both'

export class MetaConnectionError extends Error {
  constructor(public stage: string, message: string, public status?: number, public code?: number, public reason?: string) { super(message) }
}

export async function metaRequest(stage: string, url: string, init?: RequestInit): Promise<any> {
  let response: Response
  try { response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) }
  catch { throw new MetaConnectionError(stage, 'Serviciul Meta nu a răspuns. Reia conectarea.') }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data || data.error || data.error_message) {
    // Provider errors can contain credentials or request URLs. Keep them out of redirects and logs.
    const message = String(data?.error?.message ?? data?.error_message ?? '').toLowerCase()
    // Only fixed categories leave this function; never expose provider text, tokens or URLs.
    const reason = /unsupported request.*method|unsupported.*method type/.test(message) ? 'unsupported_method'
      : /client.secret|app.secret/.test(message) ? 'app_secret_rejected'
      : /access.token|oauth.*token/.test(message) ? 'token_rejected'
      : /business_management/.test(message) ? 'business_management_required'
      : /permission|app review|role|tester/.test(message) ? 'permission_or_role'
      : /redirect.uri|redirect uri/.test(message) ? 'redirect_uri'
      : 'provider_rejected'
    const detail = data?.error?.code === 190 ? 'Accesul a expirat sau a fost refuzat. Autorizează din nou contul.'
      : stage === 'instagram_long_token' ? `Instagram a refuzat activarea accesului de durată. Referință: IG-LONG-${Number(data?.error?.code) || response.status}-${reason}.`
      : 'Meta nu a finalizat acest pas. Verifică tipul contului și permisiunile acordate, apoi reîncearcă.'
    throw new MetaConnectionError(stage, detail, response.status, Number(data?.error?.code) || undefined, reason)
  }
  return data
}

export async function assertMetaAccountAvailable(businessId: string, type: 'INSTAGRAM' | 'FACEBOOK' | 'WHATSAPP', externalId: string) {
  const existing = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId } }, select: { businessId: true } })
  if (existing && existing.businessId !== businessId) throw new MetaConnectionError('account_ownership', 'Acest cont este deja conectat la altă afacere BookEasy. Deconectează-l de acolo înainte de transfer.')
}

export async function saveMetaAccounts(businessId: string, accounts: Array<{
  type: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP'; externalId: string; displayName: string; accessToken: string; authProvider: 'meta' | 'instagram'; expiresAt: Date | null; wabaId?: string
}>) {
  await prisma.$transaction(async tx => {
    for (const account of accounts) {
      const { type, externalId } = account
      // ON CONFLICT DO NOTHING prevents a concurrent callback from transferring another tenant's account.
      await tx.channel.createMany({ data: [{ ...account, accessToken: encrypt(account.accessToken), businessId }], skipDuplicates: true })
      const updated = await tx.channel.updateMany({ where: { businessId, type, externalId }, data: {
        ...account, accessToken: encrypt(account.accessToken), status: 'ACTIVE', enabledByOwner: true, connectedAt: new Date(),
      } })
      if (updated.count !== 1) throw new MetaConnectionError('account_ownership', 'Contul a fost conectat între timp la altă afacere. Reia selectarea contului.')
      // One account per card. Historical messages/bookings have no Channel FK and remain intact.
      await tx.channel.deleteMany({ where: { businessId, type, externalId: { not: externalId } } })
    }
  })
}

export async function connectDirectInstagram(businessId: string, code: string, redirectUri: string) {
  const shortResponse = await metaRequest('instagram_code', 'https://api.instagram.com/oauth/access_token', {
    method: 'POST', body: new URLSearchParams({ client_id: process.env.INSTAGRAM_APP_ID!, client_secret: process.env.INSTAGRAM_APP_SECRET!, grant_type: 'authorization_code', redirect_uri: redirectUri, code }),
  })
  const shortToken = shortResponse.data?.[0] ?? shortResponse
  if (!shortToken.access_token) throw new MetaConnectionError('instagram_code', 'Instagram nu a acordat accesul la cont.')
  if (shortToken.permissions) {
    const granted = Array.isArray(shortToken.permissions) ? shortToken.permissions : String(shortToken.permissions).split(',')
    if (!['instagram_business_basic', 'instagram_business_manage_messages'].every(p => granted.includes(p))) throw new MetaConnectionError('instagram_permissions', 'Acordă acces la profil și mesaje pentru a conecta Instagram.')
  }
  const url = new URL('https://graph.instagram.com/access_token')
  url.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: process.env.INSTAGRAM_APP_SECRET!, access_token: shortToken.access_token }).toString()
  const token = await metaRequest('instagram_long_token', url.toString())
  if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new MetaConnectionError('instagram_long_token', 'Instagram nu a emis un token de durată lungă valid.')
  const headers = { Authorization: `Bearer ${token.access_token}` }
  const profileResponse = await metaRequest('instagram_profile', `${INSTAGRAM_GRAPH}/me?fields=user_id,username`, { headers })
  const profile = profileResponse.data?.[0] ?? profileResponse
  const externalId = String(profile.user_id ?? '')
  if (!/^\d+$/.test(externalId)) throw new MetaConnectionError('instagram_profile', 'Instagram nu a returnat identificatorul contului profesional.')
  await assertMetaAccountAvailable(businessId, 'INSTAGRAM', externalId)
  const subscription = await metaRequest('instagram_subscription', `${INSTAGRAM_GRAPH}/me/subscribed_apps`, {
    method: 'POST', headers, body: new URLSearchParams({ subscribed_fields: 'messages,messaging_postbacks' }),
  })
  if (subscription.success !== true) throw new MetaConnectionError('instagram_subscription', 'Meta nu a confirmat abonarea Instagram la mesaje.')
  await saveMetaAccounts(businessId, [{ type: 'INSTAGRAM', externalId, displayName: profile.username ? `@${profile.username}` : externalId, accessToken: token.access_token, authProvider: 'instagram', expiresAt: new Date(Date.now() + token.expires_in * 1000) }])
}

type FacebookPage = { id: string; name?: string; access_token: string; instagram_business_account?: { id: string; username?: string } }
type PendingFacebookPayload = { pages: FacebookPage[]; choice: MetaChannelChoice; expiresAt: string }
type MetaSelectionContext = { userId: string; redirectTo: string }

async function recoverGrantedFacebookPages(accessToken: string, fields: string, listedPages: any[]): Promise<FacebookPage[]> {
  const debugUrl = new URL(`${FACEBOOK_GRAPH}/debug_token`)
  debugUrl.searchParams.set('input_token', accessToken)
  // The app credential and the user's token go only to Meta, never to redirects/logs.
  const inspection = await metaRequest('facebook_grants', debugUrl.toString(), {
    headers: { Authorization: `Bearer ${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` },
  })
  const grant = inspection.data
  if (!grant?.is_valid || String(grant.app_id) !== process.env.META_APP_ID) throw new MetaConnectionError('facebook_grants', 'Autorizația Facebook nu este validă pentru BookEasy. Reia conectarea.', undefined, undefined, 'invalid_app_grant')
  if (Array.isArray(grant.scopes) && !grant.scopes.includes('pages_show_list')) throw new MetaConnectionError('facebook_grants', 'Meta nu a acordat permisiunea de acces la Pagini. Reia conectarea și verifică permisiunile BookEasy.', undefined, undefined, 'missing_pages_show_list')
  const scopes = Array.isArray(grant.granular_scopes) ? grant.granular_scopes : []
  const selectedIds = scopes.filter((scope: any) => scope.scope === 'pages_show_list').flatMap((scope: any) => scope.target_ids ?? [])
  const metadataIds = scopes.filter((scope: any) => scope.scope === 'pages_manage_metadata').flatMap((scope: any) => scope.target_ids ?? [])
  const ids = [...new Set([...listedPages.map(page => page.id), ...(selectedIds.length ? selectedIds : metadataIds)].map(String).filter(id => /^\d+$/.test(id)))]
  if (ids.length > 20) throw new MetaConnectionError('facebook_grants', 'Meta a returnat prea multe active pentru verificarea directă. Reia conectarea selectând doar Paginile dorite.', undefined, undefined, 'too_many_direct_targets')
  console.info('[business-meta-page-discovery]', { listed: listedPages.length, authorizedTargets: ids.length })
  // The specific-Page token endpoint checks the same user's existing grant. Never
  // accept a Page ID from a URL/form or use a different person's Page credential.
  const results = await Promise.allSettled(ids.map(async id => {
    const page = await metaRequest('facebook_page_token', `${FACEBOOK_GRAPH}/${id}?fields=${encodeURIComponent(fields)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (String(page.id) !== id || typeof page.access_token !== 'string' || !page.access_token) return null
    return { ...page, id } as FacebookPage
  }))
  const pages = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
  console.info('[business-meta-page-discovery-result]', { authorizedTargets: ids.length, usable: pages.length, denied: results.filter(result => result.status === 'rejected').length })
  if (!pages.length) {
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
  }
  return pages
}

export async function connectViaFacebook(businessId: string, code: string, redirectUri: string, choice: MetaChannelChoice, selection?: MetaSelectionContext): Promise<{ connectionId: string } | null> {
  const short = await metaRequest('facebook_code', `${FACEBOOK_GRAPH}/oauth/access_token`, { method: 'POST', body: new URLSearchParams({ code, client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }) })
  if (!short.access_token) throw new MetaConnectionError('facebook_code', 'Facebook nu a returnat accesul autorizat.')
  const longUrl = new URL(`${FACEBOOK_GRAPH}/oauth/access_token`)
  longUrl.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, fb_exchange_token: short.access_token }).toString()
  const token = await metaRequest('facebook_long_token', longUrl.toString())
  if (!token.access_token) throw new MetaConnectionError('facebook_long_token', 'Facebook nu a returnat un token valid.')
  const fields = choice === 'messenger' ? 'id,name,access_token' : 'id,name,access_token,instagram_business_account{id,username}'
  const headers = { Authorization: `Bearer ${token.access_token}` }
  let next: string | null = `${FACEBOOK_GRAPH}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100`
  const pages: any[] = []
  for (let n = 0; next && n < 20; n++) {
    const result = await metaRequest('facebook_pages', next, { headers })
    pages.push(...(result.data ?? []))
    const after = result.paging?.cursors?.after
    next = result.paging?.next && after ? `${FACEBOOK_GRAPH}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100&after=${encodeURIComponent(after)}` : null
  }
  if (next) throw new MetaConnectionError('facebook_pages', 'Contul are prea multe Pagini Facebook pentru această conectare. Contactează echipa BookEasy.')
  let usablePages = [...new Map(pages.filter(page => /^\d+$/.test(String(page.id ?? '')) && typeof page.access_token === 'string' && page.access_token).map(page => [String(page.id), { ...page, id: String(page.id) } as FacebookPage])).values()]
  if (!usablePages.length) usablePages = await recoverGrantedFacebookPages(token.access_token, fields, pages)
  if (!usablePages.length) throw new MetaConnectionError('facebook_pages', 'Pagina selectată nu a oferit accesul tehnic necesar către BookEasy. Verifică accesul Facebook al contului la Pagină și permisiunile integrării. Referință: FB-NO-PAGE-TOKEN.', undefined, undefined, pages.length ? 'listed_without_page_token' : 'no_authorized_page_token')
  const expiresAt = new Date(Date.now() + Number(token.expires_in ?? 5184000) * 1000)
  if (usablePages.length > 1) {
    if (!selection) throw new MetaConnectionError('facebook_pages', 'Alege Pagina afacerii în BookEasy. Reia conectarea din Setări.')
    const payload: PendingFacebookPayload = { pages: usablePages, choice, expiresAt: expiresAt.toISOString() }
    await prisma.pendingMetaConnection.deleteMany({ where: { expiresAt: { lte: new Date() } } })
    const connection = await prisma.pendingMetaConnection.create({ data: {
      businessId, userId: selection.userId, redirectTo: selection.redirectTo,
      payload: encrypt(JSON.stringify(payload)), expiresAt: new Date(Date.now() + 10 * 60_000),
    }, select: { id: true } })
    return { connectionId: connection.id }
  }
  await connectFacebookPage(businessId, usablePages[0], choice, expiresAt)
  return null
}

async function connectFacebookPage(businessId: string, page: FacebookPage, choice: MetaChannelChoice, expiresAt: Date) {
  const ig = page.instagram_business_account
  if (!page.id || !page.access_token) throw new MetaConnectionError('facebook_pages', 'Pagina selectată nu a acordat acces la mesaje.')
  if (choice === 'instagram' && !ig?.id) throw new MetaConnectionError('facebook_instagram', 'Pagina selectată nu are asociat un cont Instagram profesional. Asociază contul profesional cu Pagina Facebook sau alege altă pagină.')
  const accounts = []
  if (choice !== 'instagram') accounts.push({ type: 'FACEBOOK' as const, externalId: String(page.id), displayName: String(page.name ?? page.id), accessToken: page.access_token, authProvider: 'meta' as const, expiresAt })
  if (choice !== 'messenger' && ig?.id) accounts.push({ type: 'INSTAGRAM' as const, externalId: String(ig.id), displayName: ig.username ? `@${ig.username}` : String(ig.id), accessToken: page.access_token, authProvider: 'meta' as const, expiresAt })
  for (const account of accounts) await assertMetaAccountAvailable(businessId, account.type, account.externalId)
  // Facebook Login delivers Messenger and linked Instagram events through the Page subscription.
  const subscribed = await metaRequest('facebook_subscription', FACEBOOK_GRAPH + '/' + page.id + '/subscribed_apps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + page.access_token },
    body: new URLSearchParams({ subscribed_fields: 'messages,messaging_postbacks,message_deliveries,message_reads' }),
  })
  if (subscribed.success !== true) throw new MetaConnectionError('facebook_subscription', 'Meta nu a confirmat abonarea la mesaje.')
  await saveMetaAccounts(businessId, accounts)
}

// Only names and IDs reach the selection screen. Page tokens stay encrypted on the server.
export async function pendingMetaPageChoices(id: string, userId: string, businessId?: string) {
  const pending = await prisma.pendingMetaConnection.findFirst({ where: { id, userId, ...(businessId ? { businessId } : {}), expiresAt: { gt: new Date() }, claimedAt: null } })
  if (!pending) return null
  const payload = JSON.parse(decrypt(pending.payload)) as PendingFacebookPayload
  return { id: pending.id, redirectTo: pending.redirectTo, pages: payload.pages.map(page => ({
    id: page.id, name: page.name || page.id, instagram: page.instagram_business_account?.username ?? null,
    available: payload.choice !== 'instagram' || Boolean(page.instagram_business_account?.id),
  })) }
}

export async function selectMetaPage(id: string, userId: string, businessId: string, pageId: string) {
  const pending = await prisma.pendingMetaConnection.findFirst({ where: { id, userId, businessId, expiresAt: { gt: new Date() }, claimedAt: null } })
  if (!pending) throw new MetaConnectionError('selection', 'Alegerea a expirat sau conectarea este deja în curs. Reia conectarea din Setări.')
  const payload = JSON.parse(decrypt(pending.payload)) as PendingFacebookPayload
  const page = payload.pages.find(candidate => candidate.id === pageId)
  if (!page) throw new MetaConnectionError('selection', 'Alege o Pagină dintre cele autorizate de tine.')
  const claimedAt = new Date()
  const claim = await prisma.pendingMetaConnection.updateMany({ where: { id, userId, businessId, expiresAt: { gt: claimedAt }, claimedAt: null }, data: { claimedAt } })
  if (claim.count !== 1) throw new MetaConnectionError('selection', 'Conectarea este deja în curs. Așteaptă finalizarea ei.')
  try {
    await connectFacebookPage(businessId, page, payload.choice, new Date(payload.expiresAt))
    await prisma.pendingMetaConnection.deleteMany({ where: { id, userId, businessId, claimedAt } })
    const connected = payload.choice === 'both' ? 'meta' : payload.choice === 'instagram' ? 'instagram' : 'messenger'
    return { redirectTo: pending.redirectTo, connected }
  } catch (error) {
    await prisma.pendingMetaConnection.updateMany({ where: { id, userId, businessId, claimedAt }, data: { claimedAt: null } })
    throw error
  }
}
