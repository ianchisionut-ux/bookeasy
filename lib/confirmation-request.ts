import { sendBusinessSms } from '@/lib/sms-gateway'
import { confirmationSms } from '@/lib/sms-policy'
import { compactConfirmationToken } from '@/lib/confirmation-link'
import { smsJobMessage } from '@/lib/sms-job-status'

export async function sendConfirmationRequest(booking: any): Promise<{ success: boolean; error?: string; channel?: 'SMS'; jobId?: string; status?: string; message?: string }> {
  const recipient = booking.customer?.phone
  if (!recipient) return { success: false, error: 'Clientul nu are un număr de telefon.' }
  if (!booking.confirmationRequestToken) return { success: false, error: 'Linkul de confirmare nu a putut fi generat.' }

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: booking.business.timezone || 'Europe/Bucharest',
  })
  try {
    const appUrl = (process.env.APP_URL || 'https://bookeasy.ro').replace(/\/$/, '').replace('https://www.bookeasy.ro', 'https://bookeasy.ro')
    const link = `${appUrl}/confirmare/${compactConfirmationToken(booking.confirmationRequestToken)}`
    const text = confirmationSms(booking.business.name, dateTime, link, booking.service.name)
    const job = await sendBusinessSms({ business: booking.business, to: recipient, text, bookingId: booking.id, kind: 'RECONFIRMATION', expiresAt: booking.startAt, idempotencyKey: `confirm-${booking.id}-${booking.confirmationRequestToken}` })
    return { success: true, channel: 'SMS', jobId: job.id, status: job.status, message: smsJobMessage(job.status) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Eroare necunoscută la trimiterea SMS-ului.' }
  }
}
