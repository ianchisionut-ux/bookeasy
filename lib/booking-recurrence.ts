export type BookingFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

export type RecurringSlot = { startAt: Date; endAt: Date; localDate: string }

const TIME_ZONE = 'Europe/Bucharest'
const MAX_OCCURRENCES = 53
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function localParts(value: Date) {
  const parts = formatter.formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

function localToUtc(date: string, time: string): Date {
  const localAsUtc = Date.parse(`${date}T${time}:00Z`)
  // Bucharest uses UTC+2 in winter and UTC+3 in summer. Prefer the earlier
  // occurrence of an ambiguous clock time on the autumn DST transition.
  for (const offsetMinutes of [180, 120]) {
    const candidate = new Date(localAsUtc - offsetMinutes * 60_000)
    const actual = localParts(candidate)
    if (actual.date === date && actual.time === time) return candidate
  }
  throw new Error(`Ora ${time} nu există în data de ${date} din cauza schimbării orei.`)
}

function occurrenceDate(firstDate: string, frequency: BookingFrequency, index: number): string {
  const [year, month, day] = firstDate.split('-').map(Number)
  if (frequency === 'MONTHLY') {
    const monthStart = new Date(Date.UTC(year, month - 1 + index, 1))
    const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate()
    monthStart.setUTCDate(Math.min(day, lastDay))
    return monthStart.toISOString().slice(0, 10)
  }
  const date = new Date(`${firstDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + index * (frequency === 'BIWEEKLY' ? 14 : 7))
  return date.toISOString().slice(0, 10)
}

export function buildRecurringSlots(firstStartAt: Date, durationMinutes: number, frequency: BookingFrequency, untilDate: string): RecurringSlot[] {
  if (!Number.isFinite(firstStartAt.getTime()) || !Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Data sau durata programării nu este validă.')
  }
  if (!['WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(frequency)) throw new Error('Repetarea aleasă nu este validă.')
  const parsedUntil = /^\d{4}-\d{2}-\d{2}$/.test(untilDate) ? new Date(`${untilDate}T00:00:00Z`) : null
  if (!parsedUntil || !Number.isFinite(parsedUntil.getTime()) || parsedUntil.toISOString().slice(0, 10) !== untilDate) {
    throw new Error('Data de încheiere nu este validă.')
  }

  const first = localParts(firstStartAt)
  const oneYearLater = new Date(`${first.date}T00:00:00Z`)
  oneYearLater.setUTCFullYear(oneYearLater.getUTCFullYear() + 1)
  if (untilDate <= first.date || untilDate > oneYearLater.toISOString().slice(0, 10)) {
    throw new Error('Alege o dată de încheiere după prima programare, în maximum un an.')
  }

  const slots: RecurringSlot[] = []
  for (let index = 0; index <= MAX_OCCURRENCES; index++) {
    const localDate = occurrenceDate(first.date, frequency, index)
    if (localDate > untilDate) break
    if (index === MAX_OCCURRENCES) throw new Error(`O serie poate avea cel mult ${MAX_OCCURRENCES} programări.`)
    const startAt = index === 0 ? firstStartAt : localToUtc(localDate, first.time)
    slots.push({ startAt, endAt: new Date(startAt.getTime() + durationMinutes * 60_000), localDate })
  }
  if (slots.length < 2) throw new Error('Perioada aleasă trebuie să includă cel puțin două programări.')
  return slots
}
