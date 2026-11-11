import assert from 'node:assert/strict'
import { effectiveBusinessPlan } from '../lib/business-plans.ts'
import { platformSmsReady } from '../lib/sms-availability.ts'

const now = new Date('2026-11-04T12:00:00Z').getTime()
const connected = { enabled: true, phone: '+40712345678', lastSeenAt: new Date(now - 30_000) }
assert.equal(platformSmsReady(connected, now), true)
assert.equal(platformSmsReady({ ...connected, phone: null }, now), false)
assert.equal(platformSmsReady({ ...connected, enabled: false }, now), false)
assert.equal(platformSmsReady({ ...connected, lastSeenAt: new Date(now - 121_000) }, now), false)
assert.equal(platformSmsReady(null, now), false)

assert.equal(effectiveBusinessPlan({ planName: 'Lansare · Gratuit', billingStatus: 'GRATUIT', launchEnrollment: { cancelledAt: null } }), 'PRO')
assert.equal(effectiveBusinessPlan({ planName: 'Pro', billingStatus: 'NEPLATIT' }), 'PRO')
assert.equal(effectiveBusinessPlan({ planName: 'Gratuit', billingStatus: 'GRATUIT' }), 'FREE')
assert.equal(effectiveBusinessPlan({ planName: 'Standard', billingStatus: 'NEPLATIT' }), 'STANDARD')
assert.equal(effectiveBusinessPlan({ planName: 'Lansare · Gratuit', billingStatus: 'GRATUIT', launchEnrollment: { cancelledAt: new Date(now) } }), 'FREE')

console.log('Plan entitlement and SMS availability checks passed.')
