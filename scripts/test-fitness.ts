import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calendarDate, entryPlan, clientProgress, entryEdit, messageInput } from '../lib/fitness-validation'

const plan = { kind: 'WORKOUT', date: '2026-09-09', time: '09:00', title: 'Mobilitate', details: '3 serii' }
assert.equal(entryPlan.parse(plan).kind, 'WORKOUT')
assert.equal(entryPlan.parse({ ...plan, kind: 'NUTRITION' }).kind, 'NUTRITION')
for (const date of ['2026-02-30', '2026-13-01', '2026-00-01', 'invalid']) assert.equal(calendarDate.safeParse(date).success, false)
assert.equal(calendarDate.safeParse('2028-02-29').success, true)
for (const time of ['24:00', '12:99', '9:00']) assert.equal(entryPlan.safeParse({ ...plan, time }).success, false)
assert.equal(entryPlan.safeParse({ ...plan, clientId: 'another-client' }).success, false)
assert.equal(entryPlan.safeParse({ ...plan, kind: 'BOOKING' }).success, false)
assert.equal(clientProgress.safeParse({ completed: true, feedback: 'Gata', version: 1 }).success, true)
for (const injection of [{ title: 'changed' }, { clientId: 'other' }, { details: 'changed' }, { kind: 'WORKOUT' }, { date: '2026-01-01' }]) {
  assert.equal(clientProgress.safeParse({ completed: true, feedback: '', version: 1, ...injection }).success, false)
}
assert.equal(entryEdit.safeParse({ ...plan, version: 0 }).success, false)
assert.equal(entryEdit.safeParse({ ...plan, version: 1, completed: true }).success, false)
assert.equal(messageInput.safeParse({ text: '   ' }).success, false)
assert.equal(messageInput.safeParse({ text: 'a'.repeat(4001) }).success, false)
assert.equal(messageInput.safeParse({ text: 'Salut', sender: 'INSTRUCTOR' }).success, false)

// Structural regression checks supplement runtime validator tests; not DB integration tests.
const auth = readFileSync('lib/fitness-auth.ts', 'utf8')
assert.match(auth, /user\.role !== 'OWNER'/)
assert.match(auth, /business\.category !== 'FITNESS'/)
assert.match(auth, /client\.active/)
assert.match(auth, /headers\.get\('origin'\)/)
const session = readFileSync('app/api/fitness/session/route.ts', 'utf8')
assert.match(session, /consumed\.count !== 1/)
assert.match(session, /httpOnly: true/)
assert.match(session, /inviteHash: null/)
const updates = readFileSync('app/api/fitness/entries/[id]/route.ts', 'utf8')
assert.match(updates, /where: \{ id, clientId: client.id, version \}/)
assert.match(updates, /await input\(req, clientProgress\)/)
console.log('Fitness validation and access-boundary regression checks passed.')
