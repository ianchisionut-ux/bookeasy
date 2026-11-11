import { createHmac, createPrivateKey, sign, timingSafeEqual } from 'node:crypto'
import { getVercelOidcToken } from '@vercel/oidc'
import { effectiveBusinessPlan } from './business-plans'
import { isWalletEligibleCategory } from './wallet-eligibility'

type WalletBusiness = {
  id: string
  name: string
  category: string
  planName: string | null
  billingStatus: string
  launchEnrollment?: { cancelledAt: Date | null } | null
}

type WalletBooking = {
  id: string
  startAt: Date
  endAt: Date
  serviceName: string
  business: WalletBusiness
}

function config() {
  if (process.env.GOOGLE_WALLET_ENABLED !== 'true') return null
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
  const classId = process.env.GOOGLE_WALLET_CLASS_ID
  const qrSecret = process.env.GOOGLE_WALLET_QR_SECRET
  if (!issuerId || !classId?.startsWith(`${issuerId}.`) || !qrSecret || qrSecret.length < 32) return null
  const clientEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
  const wifAudience = process.env.GOOGLE_WALLET_WIF_AUDIENCE
  if (clientEmail && wifAudience?.startsWith('//iam.googleapis.com/projects/')) {
    return { issuerId, classId, qrSecret, clientEmail, wifAudience, privateKey: null }
  }
  const accountJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON
  if (accountJson) {
    try {
      const account = JSON.parse(accountJson) as { client_email?: string; private_key?: string }
      if (account.client_email && account.private_key) {
        return { issuerId, classId, qrSecret, clientEmail: account.client_email, wifAudience: null, privateKey: account.private_key }
      }
    } catch { /* An invalid credential must never enable Wallet. */ }
  }
  return null
}

export function walletConfigured() { return Boolean(config()) }

function qrSignature(secret: string, bookingId: string, businessId: string) {
  return createHmac('sha256', secret).update(`${bookingId}:${businessId}`).digest('hex')
}

export function verifyWalletQr(code: string, businessId: string) {
  const settings = config()
  if (!settings) return null
  const match = /^([A-Za-z0-9_-]{8,64})\.([a-f0-9]{64})$/.exec(code)
  if (!match) return null
  const expected = Buffer.from(qrSignature(settings.qrSecret, match[1], businessId), 'hex')
  const received = Buffer.from(match[2], 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected) ? match[1] : null
}

function base64url(value: string | Buffer) { return Buffer.from(value).toString('base64url') }
function localized(value: string) { return { defaultValue: { language: 'ro-RO', value } } }

async function signWalletJwt(payload: object, settings: NonNullable<ReturnType<typeof config>>) {
  if (settings.privateKey) {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const body = base64url(JSON.stringify(payload))
    const input = `${header}.${body}`
    const signature = sign('RSA-SHA256', Buffer.from(input), createPrivateKey(settings.privateKey)).toString('base64url')
    return `${input}.${signature}`
  }
  if (!settings.wifAudience) throw new Error('Wallet signer is not configured')
  const subjectToken = await getVercelOidcToken()
  const exchange = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: settings.wifAudience,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      subject_token: subjectToken,
    }),
    cache: 'no-store',
  })
  if (!exchange.ok) throw new Error(`Wallet OIDC exchange failed (${exchange.status})`)
  const token = await exchange.json() as { access_token?: string }
  if (!token.access_token) throw new Error('Wallet OIDC exchange returned no access token')
  const signed = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(settings.clientEmail)}:signJwt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: JSON.stringify(payload) }),
    cache: 'no-store',
  })
  if (!signed.ok) throw new Error(`Wallet JWT signing failed (${signed.status})`)
  const result = await signed.json() as { signedJwt?: string }
  if (!result.signedJwt) throw new Error('Wallet JWT signing returned no token')
  return result.signedJwt
}

export async function createBookingWalletLink(booking: WalletBooking, origin: string) {
  const settings = config()
  if (!settings || !isWalletEligibleCategory(booking.business.category) || effectiveBusinessPlan(booking.business) !== 'PRO') return null
  if (!['https:', 'http:'].includes(new URL(origin).protocol)) return null
  const code = `${booking.id}.${qrSignature(settings.qrSecret, booking.id, booking.business.id)}`
  const barcodeUrl = `${origin}/dashboard/check-in?code=${code}`
  const date = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'medium', timeStyle: 'short' }).format(booking.startAt)
  const payload = {
    iss: settings.clientEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [new URL(origin).host],
    payload: { genericObjects: [{
      id: `${settings.issuerId}.booking_${booking.id}`,
      classId: settings.classId,
      cardTitle: localized(booking.business.name),
      header: localized(booking.serviceName),
      subheader: localized('Rezervare BookEasy'),
      barcode: { type: 'QR_CODE', value: barcodeUrl, alternateText: `#${booking.id.slice(-8).toUpperCase()}` },
      textModulesData: [{ id: 'booking_time', header: 'Data și ora', body: date }],
      hexBackgroundColor: '#168B8B',
    }] },
  }
  const jwt = await signWalletJwt(payload, settings)
  // Browsers may truncate long save links; a single pre-created class keeps this short.
  if (jwt.length > 1800) return null
  return `https://pay.google.com/gp/v/save/${jwt}`
}
