import { createHmac, createPrivateKey, sign, timingSafeEqual } from 'node:crypto'
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
  const accountJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON
  if (accountJson) {
    try {
      const account = JSON.parse(accountJson) as { client_email?: string; private_key?: string }
      if (account.client_email && account.private_key) {
        return { issuerId, classId, qrSecret, clientEmail: account.client_email, privateKey: account.private_key }
      }
    } catch { /* An invalid credential must never enable Wallet. */ }
  }
  return null
}

export function walletConfigured() { return Boolean(config()) }

function publishedConfig() {
  return process.env.GOOGLE_WALLET_PUBLISHING_APPROVED === 'true' ? config() : null
}

export function walletAvailable() { return Boolean(publishedConfig()) }

function qrSignature(secret: string, bookingId: string, businessId: string) {
  return createHmac('sha256', secret).update(`${bookingId}:${businessId}`).digest('hex')
}

function walletLinkSignature(secret: string, bookingId: string, businessId: string) {
  return createHmac('sha256', secret).update(`wallet-link:${bookingId}:${businessId}`).digest('hex')
}

export function createBookingWalletRedirectUrl(booking: { id: string; business: WalletBusiness }, origin: string) {
  const settings = publishedConfig()
  if (!settings || !isWalletEligibleCategory(booking.business.category) || effectiveBusinessPlan(booking.business) !== 'PRO') return null
  const url = new URL(origin)
  if (!['https:', 'http:'].includes(url.protocol)) return null
  url.pathname = `/api/public/bookings/${encodeURIComponent(booking.id)}/wallet`
  url.search = ''
  url.searchParams.set('token', walletLinkSignature(settings.qrSecret, booking.id, booking.business.id))
  return url.toString()
}

export function verifyBookingWalletRedirectToken(bookingId: string, businessId: string, token: string) {
  const settings = publishedConfig()
  if (!settings || !/^[a-f0-9]{64}$/.test(token)) return false
  const expected = Buffer.from(walletLinkSignature(settings.qrSecret, bookingId, businessId), 'hex')
  return timingSafeEqual(expected, Buffer.from(token, 'hex'))
}

export function verifyWalletQr(code: string, businessId: string) {
  const settings = publishedConfig()
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
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const input = `${header}.${body}`
  const signature = sign('RSA-SHA256', Buffer.from(input), createPrivateKey(settings.privateKey)).toString('base64url')
  return `${input}.${signature}`
}

export async function createBookingWalletLink(booking: WalletBooking, origin: string) {
  const settings = publishedConfig()
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
