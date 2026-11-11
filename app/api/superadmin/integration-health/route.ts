import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import {walletConfigured} from '@/lib/google-wallet'
import {googleBusinessCredentials,refreshGoogleBusinessToken} from '@/lib/google-business-oauth'
import {isPlatformSmsReady} from '@/lib/sms-routing'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const requestedBusinessId = req.nextUrl.searchParams.get('businessId')
  const isSuperAdmin = Boolean((session as any).isSuperAdmin)
  const businessId = isSuperAdmin ? requestedBusinessId : (session as any).businessId
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  if (!isSuperAdmin && requestedBusinessId && requestedBusinessId !== businessId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const request = (url: string, init: RequestInit = {}) => fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const [calendars, channels] = await Promise.all([
    prisma.googleCalendarConnection.findMany({ where: { businessId } }),
    prisma.channel.findMany({ where: { businessId, type: { in: ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'GOOGLE_BUSINESS'] } } }),
  ])
  const google = []
  for (const connection of calendars) {
    try {
      let token = decrypt(connection.accessToken)
      if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now() + 60000) {
        if (!connection.refreshToken) { google.push({ status: 'reconnect_required' }); continue }
        const refresh = await request('https://oauth2.googleapis.com/token', {
          method: 'POST', body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            refresh_token: decrypt(connection.refreshToken), grant_type: 'refresh_token',
          }),
        })
        const data = await refresh.json() as { access_token?: string; error?: string }
        if (!refresh.ok || !data.access_token) { google.push({ status: 'refresh_failed', http: refresh.status, code: data.error }); continue }
        token = data.access_token
      }
      const result = await request(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}`, { headers: { Authorization: `Bearer ${token}` } })
      google.push({ status: result.ok ? 'calendar_access_ok' : 'calendar_access_failed', http: result.status, syncEnabled: connection.syncEnabled })
      await result.body?.cancel()
    } catch { google.push({ status: 'connection_or_decryption_failed' }) }
  }
  const googleBusiness=[]
  for(const channel of channels.filter(c=>c.type==='GOOGLE_BUSINESS')){
    try{
      let token=decrypt(channel.accessToken)
      if(channel.expiresAt&&channel.expiresAt.getTime()<=Date.now()+60000){if(!channel.refreshToken){googleBusiness.push({status:'reconnect_required'});continue}token=(await refreshGoogleBusinessToken(decrypt(channel.refreshToken))).access_token}
      const result=await request('https://mybusiness.googleapis.com/v4/'+channel.externalId+'/reviews?pageSize=1',{headers:{Authorization:'Bearer '+token}})
      googleBusiness.push({status:result.ok?'reviews_access_ok':'reviews_access_failed',http:result.status,enabledByOwner:channel.enabledByOwner});await result.body?.cancel()
    }catch{googleBusiness.push({status:'connection_or_decryption_failed'})}
  }
  const meta = []
  for (const channel of channels.filter(c=>c.type!=='GOOGLE_BUSINESS')) {
    try {
      const url = channel.type === 'INSTAGRAM' && channel.authProvider === 'instagram'
        ? 'https://graph.instagram.com/v26.0/me?fields=user_id,username'
        : `https://graph.facebook.com/v21.0/${encodeURIComponent(channel.externalId)}?fields=id`
      const result = await request(url, { headers: { Authorization: `Bearer ${decrypt(channel.accessToken)}` } })
      const data = await result.json() as { error?: { code?: number; error_subcode?: number } }
      meta.push({ type: channel.type, account: channel.displayName ?? channel.externalId, provider: channel.authProvider, enabledByOwner: channel.enabledByOwner, status: result.ok ? 'access_ok' : 'access_failed', http: result.status, code: data.error?.code, subcode: data.error?.error_subcode })
    } catch { meta.push({ type: channel.type, status: 'connection_or_decryption_failed' }) }
  }
  let email: Record<string, unknown> = { status: 'not_configured' }
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await request('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } })
      const data = await result.json() as { data?: { name: string; status: string }[] }
      email = {
        status: result.ok ? 'account_access_ok' : result.status === 403 ? 'sending_key_configured' : 'provider_check_failed',
        http: result.status,
        senderDomainStatus: data.data?.find(d => d.name === 'bookeasy.ro')?.status,
        notificationRecipientConfigured: Boolean(process.env.ADMIN_NOTIFICATION_EMAIL),
      }
    } catch { email = { status: 'connection_failed' } }
  }
  let platform:Record<string,unknown>|undefined
  if(isSuperAdmin&&req.nextUrl.searchParams.get('full')==='1'){
    const configured=(...names:string[])=>names.every(name=>Boolean(process.env[name]?.trim()))
    let geocoding:Record<string,unknown>={status:'not_configured'}
    if(process.env.GEOAPIFY_API_KEY){try{const url=new URL('https://api.geoapify.com/v1/geocode/search');url.search=new URLSearchParams({text:'Zalău, România',filter:'countrycode:ro',format:'json',limit:'1',apiKey:process.env.GEOAPIFY_API_KEY}).toString();const response=await request(url.toString());const data=await response.json();geocoding={status:response.ok&&data.results?.length?'access_ok':'provider_check_failed',http:response.status}}catch{geocoding={status:'connection_failed'}}}
    platform={
      googleLoginAndCalendarConfigured:configured('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'),googleBusinessConfigured:Boolean(googleBusinessCredentials()),
      metaOAuthConfigured:configured('META_APP_ID','META_APP_SECRET'),metaWebhookVerificationConfigured:configured('META_VERIFY_TOKEN'),instagramDirectOAuthConfigured:configured('INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET'),
      smsReady:await isPlatformSmsReady(),geocoding,storageConfigured:configured('BLOB_READ_WRITE_TOKEN'),
      wallet:{enabled:process.env.GOOGLE_WALLET_ENABLED==='true',credentialsConfigured:walletConfigured(),productionApproval:'Verify in Google Wallet Console; configuration alone does not prove approval.'},
      subscriptionOnlinePayments:'disabled',
    }
  }
  return NextResponse.json({ google,googleBusiness, meta, email,...(platform?{platform}:{}), scope: 'Provider access only; no appointments, messages or emails sent.' }, { headers: { 'Cache-Control': 'no-store' } })
}
