'use client'

import type { SmsAllowance } from '@/lib/sms-limits'

export default function BookingSmsHistory({ allowance }: { allowance?: SmsAllowance }) {
  const sentAt = allowance?.lastReminderSentAt
  if (!sentAt) return null

  const date = new Date(sentAt)
  if (Number.isNaN(date.getTime())) return null

  return (
    <div className="mt-2 whitespace-normal text-left text-[11px] leading-relaxed text-gray-500">
      <time aria-label="Ultimul reminder SMS" dateTime={sentAt}>
        {date.toLocaleString('ro-RO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Bucharest',
        })}
      </time>
    </div>
  )
}
