import { sendBusinessSms } from '@/lib/sms-gateway'
import { reminderSms } from '@/lib/sms-policy'
import { smsJobMessage } from '@/lib/sms-job-status'

export async function sendAppointmentReminderSms(booking: any): Promise<{ success: boolean; error?: string; channel?: 'SMS'; jobId?: string; status?: string; message?: string }> {
  const recipient = booking.customer?.phone
  if (!recipient) return { success: false, error: 'Clientul nu are un număr de telefon.' }

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: booking.business.timezone || 'Europe/Bucharest',
  })

  try {
    const text = reminderSms(booking.business.name, dateTime, booking.service.name)
    const job = await sendBusinessSms({
      business: booking.business, bookingId: booking.id, kind: 'REMINDER', expiresAt: booking.startAt,
      to: recipient,
      text,
      idempotencyKey: `reminder-${booking.id}-${booking.startAt.getTime()}-${Math.floor(Date.now() / 60_000)}`,
    })
    return { success: true, channel: 'SMS', jobId: job.id, status: job.status, message: smsJobMessage(job.status) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Eroare necunoscută la trimiterea SMS-ului.' }
  }
}
