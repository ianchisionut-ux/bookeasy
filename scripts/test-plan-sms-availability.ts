import assert from 'node:assert/strict'
import { effectiveBusinessPlan } from '../lib/business-plans.ts'
import { smsApiAvailability } from '../lib/smsapi.ts'

const now = new Date('2026-11-04T12:00:00Z').getTime()
const env = { BOOKEASY_SMS_PROVIDER: process.env.BOOKEASY_SMS_PROVIDER, SMSAPI_TOKEN: process.env.SMSAPI_TOKEN, SMSAPI_SENDER: process.env.SMSAPI_SENDER }
try {
  delete process.env.BOOKEASY_SMS_PROVIDER
  process.env.SMSAPI_TOKEN = 'test-token'
  process.env.SMSAPI_SENDER = 'BookEasy'
  assert.equal(smsApiAvailability().online, false)
  process.env.BOOKEASY_SMS_PROVIDER = 'smsapi'
  assert.deepEqual(smsApiAvailability(), { online: true, lastError: null })
  delete process.env.SMSAPI_SENDER
  assert.equal(smsApiAvailability().online, false)
} finally {
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

assert.equal(effectiveBusinessPlan({ planName: 'Lansare · Gratuit', billingStatus: 'GRATUIT', launchEnrollment: { cancelledAt: null } }), 'PRO')
assert.equal(effectiveBusinessPlan({ planName: 'Pro', billingStatus: 'NEPLATIT' }), 'PRO')
assert.equal(effectiveBusinessPlan({ planName: 'Gratuit', billingStatus: 'GRATUIT' }), 'FREE')
assert.equal(effectiveBusinessPlan({ planName: 'Standard', billingStatus: 'NEPLATIT' }), 'STANDARD')
assert.equal(effectiveBusinessPlan({ planName: 'Lansare · Gratuit', billingStatus: 'GRATUIT', launchEnrollment: { cancelledAt: new Date(now) } }), 'FREE')

console.log('Plan entitlement and SMS availability checks passed.')
