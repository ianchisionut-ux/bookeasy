import { after } from 'next/server'
import { syncBookingToGoogle } from './google-calendar'

export function schedulePublicBookingCalendarSync(bookingId: string, rescheduledBookingId?: string) {
  after(async () => {
    if (rescheduledBookingId) {
      await syncBookingToGoogle(rescheduledBookingId).catch((error) => console.error('[google-calendar] sync rescheduled booking:', error))
    }
    await syncBookingToGoogle(bookingId).catch((error) => console.error('[google-calendar] sync public booking:', error))
  })
}
