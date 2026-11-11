import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { verifyResendWebhook } from '../lib/platform-email'

const key = crypto.randomBytes(32)
process.env.RESEND_WEBHOOK_SECRET = `whsec_${key.toString('base64')}`
const id = 'msg_test'
const timestamp = String(Math.floor(Date.now() / 1000))
const payload = JSON.stringify({ type: 'email.received', data: { email_id: 'test' } })
const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
const headers = new Headers({
  'svix-id': id,
  'svix-timestamp': timestamp,
  'svix-signature': `v1,${signature}`,
})

assert.equal(verifyResendWebhook(payload, headers), true)
assert.equal(verifyResendWebhook(`${payload} `, headers), false)
headers.set('svix-timestamp', String(Number(timestamp) - 600))
assert.equal(verifyResendWebhook(payload, headers), false)
console.log('Webhook Resend: semnătura validă, conținutul modificat și data expirată au fost verificate.')
