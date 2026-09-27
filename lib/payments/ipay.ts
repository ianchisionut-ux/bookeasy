import { Buffer } from 'node:buffer'

export const IPAY_RON_CURRENCY = 946

export type IpayMerchant = {
  username: string
  password: string
  live: boolean
}

export type IpayStatus = Record<string, unknown> & {
  errorCode?: string | number
  errorMessage?: string
  orderStatus?: string | number
  orderNumber?: string
  currency?: string | number
  amount?: string | number
}

export type IpayInvoiceIdentity = {
  orderNumber: string | null
  amountMinor: number | null
  currency: number | null
}

const REQUEST_TIMEOUT_MS = 15_000

function baseUrl(merchant: IpayMerchant) {
  return merchant.live
    ? 'https://ecclients.btrl.ro/payment/rest'
    : 'https://ecclients-sandbox.btrl.ro/payment/rest'
}

function parseResponse(text: string): IpayStatus {
  try {
    const result = JSON.parse(text.replace(/^\uFEFF/, '').trim())
    if (!result || typeof result !== 'object') throw new Error('not an object')
    return result as IpayStatus
  } catch {
    throw new Error('BT iPay a returnat un răspuns invalid.')
  }
}

async function post(
  merchant: IpayMerchant,
  endpoint: string,
  fields: Record<string, string | number | undefined | null>,
  authenticated = true,
) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value))
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (authenticated) {
    headers.Authorization = `Basic ${Buffer.from(`${merchant.username}:${merchant.password}`, 'utf8').toString('base64')}`
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl(merchant)}/${endpoint}`, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new Error('BT iPay nu a răspuns în timpul disponibil.')
    throw new Error('Conexiunea cu BT iPay nu este disponibilă momentan.')
  }

  const result = parseResponse(await response.text())
  if (!response.ok) {
    throw new Error(String(result.errorMessage || `BT iPay a răspuns cu HTTP ${response.status}.`))
  }
  return result
}

function validatePaymentUrl(value: unknown, merchant: IpayMerchant) {
  let parsed: URL
  try {
    parsed = new URL(String(value || ''))
  } catch {
    throw new Error('BT iPay nu a returnat un URL de plată valid.')
  }
  const expectedHost = merchant.live ? 'ecclients.btrl.ro' : 'ecclients-sandbox.btrl.ro'
  if (parsed.protocol !== 'https:' || parsed.hostname !== expectedHost || !parsed.pathname.startsWith('/payment/')) {
    throw new Error('URL-ul de plată nu aparține mediului BT iPay configurat.')
  }
  return parsed.href
}

export async function registerIpayPayment(
  merchant: IpayMerchant,
  fields: Record<string, string | number>,
) {
  const result = await post(merchant, 'register.do', fields)
  if (!result.orderId || !result.formUrl || (result.errorCode !== undefined && String(result.errorCode) !== '0')) {
    throw new Error(String(result.errorMessage || 'BT iPay nu a returnat linkul de plată.'))
  }
  return {
    orderId: String(result.orderId),
    paymentUrl: validatePaymentUrl(result.formUrl, merchant),
  }
}

export function getIpayOrderStatus(merchant: IpayMerchant, orderId: string) {
  return post(merchant, 'getOrderStatusExtended.do', { orderId })
}

export function getIpayFinishedPayment(merchant: IpayMerchant, orderId: string, token: string) {
  return post(merchant, 'getFinishedPaymentInfo.do', { orderId, token, language: 'ro' }, false)
}

export function isIpayOrderIdentityMatch(status: IpayStatus | null, invoice: IpayInvoiceIdentity) {
  return Boolean(
    status &&
    String(status.errorCode) === '0' &&
    invoice.orderNumber &&
    String(status.orderNumber || '') === invoice.orderNumber &&
    invoice.currency === IPAY_RON_CURRENCY &&
    Number(status.currency) === invoice.currency &&
    Number.isSafeInteger(invoice.amountMinor) &&
    Number(invoice.amountMinor) > 0 &&
    Number(status.amount) === invoice.amountMinor
  )
}

export function isIpayPaymentConfirmed(status: IpayStatus | null, invoice: IpayInvoiceIdentity) {
  return isIpayOrderIdentityMatch(status, invoice) && Number(status?.orderStatus) === 2
}

export function isIpayPaymentTerminalFailure(status: IpayStatus | null, invoice: IpayInvoiceIdentity) {
  return isIpayOrderIdentityMatch(status, invoice) && [3, 4, 6, 7].includes(Number(status?.orderStatus))
}
