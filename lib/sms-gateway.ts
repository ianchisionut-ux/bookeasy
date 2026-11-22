import { resolveSmsSender } from '@/lib/sms-routing'
import { claimSmsApiJob, enqueueLimitedSms, type SmsPurpose } from '@/lib/sms-limits'
import { singleSms } from '@/lib/sms-policy'
import { prisma } from '@/lib/prisma'
import { smsApiConfig, submitSmsApi } from '@/lib/smsapi'
import { smsJobMessage, visibleSmsStatus } from '@/lib/sms-job-status'

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
  const jobData = { businessId: business.id, senderKey: sender.key, recipient, message: text, idempotencyKey, bookingId, kind, expiresAt }
  if (sender.key === 'smsapi') {
    const config = smsApiConfig()
    if (!config) throw new Error('SMSAPI nu este configurat complet.')
    let job = await enqueueLimitedSms({ ...jobData, senderPhone: null })
    if (job.senderKey === 'smsapi' && job.status === 'PENDING') {
      if (await claimSmsApiJob(job.id, allowDisabled)) {
        const result = await submitSmsApi(config, job)
        const outcome = { ...result, sentAt: result.status === 'SENT' ? new Date() : null }
        try {
          job = await prisma.smsJob.update({ where: { id: job.id }, data: outcome })
        } catch {
          // The dispatch claim is already committed. Preserve a possibly used reconfirmation link.
          console.error('[smsapi] Unable to save the SMS outcome.')
          job = { ...job, ...outcome }
        }
      } else {
        job = await prisma.smsJob.findUniqueOrThrow({ where: { id: job.id } })
      }
    }
    const status = visibleSmsStatus(job)
    if (status === 'FAILED' || status === 'EXPIRED' || (status === 'UNKNOWN' && job.senderKey !== 'smsapi')) {
      throw new Error(smsJobMessage(status, job.error, job.senderKey))
    }
    if (status === 'PENDING' && job.senderKey === 'smsapi') throw new Error('SMSAPI nu a putut prelua mesajul.')
    return { ...job, status }
  }
  if (sender.enabled && sender.phone) {
    if (!sender.lastSeenAt || Date.now() - sender.lastSeenAt.getTime() > 120_000) {
      throw new Error('Telefonul SMS BookEasy nu este conectat. Deschide aplicația de pe telefon.')
    }
    const job = await enqueueLimitedSms({ ...jobData, senderPhone: sender.phone })
    const status = job.senderKey === 'smsapi' ? visibleSmsStatus(job) : job.status
    if (status === 'FAILED' || status === 'EXPIRED' || (status === 'UNKNOWN' && job.senderKey !== 'smsapi')) {
      throw new Error(job.error || 'Trimiterea acestui SMS a eșuat. Nu a fost retrimis automat.')
    }
    if (status === 'PENDING' && job.senderKey === 'smsapi') throw new Error('Acest mesaj este înregistrat la SMSAPI. Verifică activitatea SMS.')
    return { ...job, status }
  }
  throw new Error('Gatewayul SMS atribuit nu este configurat sau este oprit. Contactează administratorul BookEasy.')
}
