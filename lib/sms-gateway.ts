import { resolveSmsSender } from '@/lib/sms-routing'
import { enqueueLimitedSms, type SmsPurpose } from '@/lib/sms-limits'
import { singleSms } from '@/lib/sms-policy'

export const DEFAULT_SMS_GATEWAY_URL = 'https://app.sms-gateway.app/api/v1'

type SmsBusiness = {
  id: string
  smsGatewayApiUrl: string | null
  smsGatewayApiKey: string | null
  smsGatewayDeviceId: number | null
  smsGatewayEnabled: boolean
  smsGatewayMode?: string
  smsDeviceLastSeenAt?: Date | null
}

export function normalizeSmsPhone(value: string) {
  const compact = value.replace(/[^\d+]/g, '')
  if (compact.startsWith('+')) return compact
  if (compact.startsWith('00')) return `+${compact.slice(2)}`
  if (compact.startsWith('0')) return `+40${compact.slice(1)}`
  if (compact.startsWith('40')) return `+${compact}`
  return `+${compact}`
}

export async function sendBusinessSms({
  business,
  to,
  text,
  idempotencyKey,
  allowDisabled = false,
  bookingId, kind = 'OTHER', expiresAt,
}: {
  business: SmsBusiness
  to: string
  text: string
  idempotencyKey: string
  allowDisabled?: boolean
  bookingId?: string
  kind?: SmsPurpose
  expiresAt?: Date
}) {
  text = singleSms(text)
  const recipient = normalizeSmsPhone(to)
  if (!/^\+[1-9]\d{7,14}$/.test(recipient)) throw new Error('Numărul destinatarului SMS nu este valid.')
  const sender = await resolveSmsSender(business)
  if (!sender.accountActive) throw new Error('Afacerea este suspendată.')
  if (!allowDisabled && !sender.businessEnabled) throw new Error('Gatewayul SMS este oprit pentru această afacere.')
  if (sender.enabled && sender.phone) {
    if (!sender.lastSeenAt || Date.now() - sender.lastSeenAt.getTime() > 120_000) {
      throw new Error('Telefonul SMS BookEasy nu este conectat. Deschide aplicația de pe telefon.')
    }
    const job = await enqueueLimitedSms({ businessId: business.id, senderKey: sender.key, senderPhone: sender.phone, recipient, message: text, idempotencyKey, bookingId, kind, expiresAt })
    if (['FAILED', 'EXPIRED', 'UNKNOWN'].includes(job.status)) throw new Error(job.error || 'Trimiterea acestui SMS a eșuat. Nu a fost retrimis automat.')
    return job
  }
  throw new Error('Gatewayul SMS atribuit nu este configurat sau este oprit. Contactează administratorul BookEasy.')
}
