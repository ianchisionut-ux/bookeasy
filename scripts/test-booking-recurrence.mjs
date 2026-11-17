import assert from 'node:assert/strict'
import { buildRecurringSlots } from '../lib/booking-recurrence.ts'

const weekly = buildRecurringSlots(new Date('2027-03-21T08:00:00Z'), 50, 'WEEKLY', '2027-04-04')
assert.deepEqual(weekly.map((slot) => slot.startAt.toISOString()), [
  '2027-03-21T08:00:00.000Z',
  '2027-03-28T07:00:00.000Z',
  '2027-04-04T07:00:00.000Z',
])
assert.equal(weekly[1].endAt.toISOString(), '2027-03-28T07:50:00.000Z')

const monthly = buildRecurringSlots(new Date('2027-01-31T08:00:00Z'), 30, 'MONTHLY', '2027-03-31')
assert.deepEqual(monthly.map((slot) => slot.localDate), ['2027-01-31', '2027-02-28', '2027-03-31'])
assert.deepEqual(monthly.map((slot) => slot.startAt.toISOString()), [
  '2027-01-31T08:00:00.000Z',
  '2027-02-28T08:00:00.000Z',
  '2027-03-31T07:00:00.000Z',
])

assert.throws(() => buildRecurringSlots(new Date('2027-03-21T01:30:00Z'), 30, 'WEEKLY', '2027-04-04'), /nu există/)
assert.throws(() => buildRecurringSlots(new Date('2027-01-31T08:00:00Z'), 30, 'MONTHLY', '2027-02-30'), /nu este validă/)
assert.throws(() => buildRecurringSlots(new Date('2027-01-31T08:00:00Z'), 30, 'MONTHLY', '2029-03-31'), /maximum un an/)
console.log('Recurring booking dates: OK')
