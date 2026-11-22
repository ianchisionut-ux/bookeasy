import { readBusinessSmsSettings } from '@/lib/sms-routing'
import { claimSmsApiJob, enqueueLimitedSms, type SmsPurpose } from '@/lib/sms-limits'
import { singleSms } from '@/lib/sms-policy'
import { prisma } from '@/lib/prisma'
import { smsApiConfig, submitSmsApi, usesSmsApi } from '@/lib/smsapi'
import { smsJobMessage, visibleSmsStatus } from '@/lib/sms-job-status'

function normalizeSmsPhone(value: string) {
  const compact = value.replace(/[^\d+]/g, '')
  if (compact.startsWith('+')) return compact
  if (compact.startsWith('00')) return `+${compact.slice(2)}`
  if (compact.startsWith('0')) return `+40${compact.slice(1)}`
  return `+${compact}`
}

export async function sendBusinessSms({
  business,
  to,
  text,
  idempotencyKey,
  bookingId, kind = 'OTHER', expiresAt,
}: {
  business: { id: string }
  to: string
  text: string
  idempotencyKey: string
  bookingId?: string
  kind?: SmsPurpose
  expiresAt?: Date
}) {
  text = singleSms(text)
  const recipient = normalizeSmsPhone(to)
  if (!/^\+[1-9]\d{7,14}$/.test(recipient)) throw new Error('Numărul destinatarului SMS nu este valid.')
  const settings = await readBusinessSmsSettings(business.id)
  if (!settings.accountActive) throw new Error('Afacerea este suspendată.')
  if (!settings.smsGatewayEnabled) throw new Error('Trimiterea SMS este oprită pentru această afacere.')
  if (!usesSmsApi()) throw new Error('Trimiterea prin SMSAPI este dezactivată.')
  const config = smsApiConfig()
  if (!config) throw new Error('SMSAPI nu este configurat complet.')

  let job = await enqueueLimitedSms({ businessId: business.id, recipient, message: text, idempotencyKey, bookingId, kind, expiresAt })
  if (job.senderKey === 'smsapi' && job.status === 'PENDING') {
    if (await claimSmsApiJob(job.id)) {
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
  if (['FAILED', 'EXPIRED', 'RETIRED'].includes(status) || (status === 'UNKNOWN' && job.senderKey !== 'smsapi')) {
    throw new Error(smsJobMessage(status, job.error, job.senderKey))
  }
  if (status === 'PENDING') throw new Error('SMSAPI nu a putut prelua mesajul.')
  return { ...job, status }
}
