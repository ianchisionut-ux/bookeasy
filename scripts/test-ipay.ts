import assert from 'node:assert/strict'
import {
  IPAY_RON_CURRENCY,
  isIpayOrderIdentityMatch,
  isIpayPaymentConfirmed,
  isIpayPaymentTerminalFailure,
  registerIpayPayment,
} from '../lib/payments/ipay.ts'

const invoice = { orderNumber: 'BE-test-123', amountMinor: 11_900, currency: IPAY_RON_CURRENCY }
const deposited = { errorCode: '0', orderStatus: 2, orderNumber: 'BE-test-123', currency: 946, amount: 11_900 }

assert.equal(isIpayOrderIdentityMatch(deposited, invoice), true)
assert.equal(isIpayPaymentConfirmed(deposited, invoice), true)
assert.equal(isIpayPaymentConfirmed({ ...deposited, amount: 11_899 }, invoice), false)
assert.equal(isIpayPaymentConfirmed({ ...deposited, currency: 978 }, invoice), false)
assert.equal(isIpayPaymentTerminalFailure({ ...deposited, orderStatus: 3 }, invoice), true)
assert.equal(isIpayPaymentTerminalFailure({ ...deposited, orderStatus: 1 }, invoice), false)

const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    errorCode: '0',
    orderId: '11111111-2222-3333-4444-555555555555',
    formUrl: 'https://ecclients-sandbox.btrl.ro/payment/merchants/test/payment_ro.html',
  }), { status: 200 })
  const registered = await registerIpayPayment(
    { username: 'sandbox', password: 'secret', live: false },
    { orderNumber: 'BE-test-123', amount: 11_900, currency: 946 },
  )
  assert.equal(registered.orderId, '11111111-2222-3333-4444-555555555555')

  globalThis.fetch = async () => new Response(JSON.stringify({
    errorCode: '0',
    orderId: '11111111-2222-3333-4444-555555555555',
    formUrl: 'https://payments.example.test/phishing',
  }), { status: 200 })
  await assert.rejects(
    registerIpayPayment({ username: 'sandbox', password: 'secret', live: false }, { orderNumber: 'BE-test-123' }),
    /nu aparține mediului BT iPay/,
  )
} finally {
  globalThis.fetch = originalFetch
}

console.log('BT iPay billing tests: OK')
