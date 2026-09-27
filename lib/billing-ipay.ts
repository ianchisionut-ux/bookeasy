import { amountToMinorUnits, getInvoiceReference } from '@/lib/billing-invoice'
import {
  getIpayFinishedPayment,
  getIpayOrderStatus,
  IPAY_RON_CURRENCY,
  IpayInvoiceIdentity,
  IpayMerchant,
  isIpayPaymentConfirmed,
  isIpayPaymentTerminalFailure,
  registerIpayPayment,
} from '@/lib/payments/ipay'

export const ACTIVE_IPAY_STATES = ['REGISTERING', 'REGISTERED', 'VERIFYING'] as const
export const IPAY_ATTEMPT_TTL_MS = 30 * 60 * 1000

export function resetIpayPaymentFields() {
  return {
    billingIpayOrderId: null,
    billingIpayOrderNumber: null,
    billingIpayPaymentState: null,
    billingIpayPaymentError: null,
    billingIpayStartedAt: null,
    billingIpayAmountMinor: null,
    billingIpayCurrency: null,
    billingIpayInvoiceReference: null,
  } as const
}

type BillingBusiness = {
  id: string
  name: string
  planName: string | null
  contactPhone: string | null
  billingLegalName: string | null
  billingAddress: string | null
  billingCity: string | null
  billingEmail: string | null
  billingInvoiceUrl: string | null
  billingInvoiceName: string | null
  billingInvoiceExternalId: string | null
  billingInvoiceUploadedAt: Date | null
  billingStatus: string
  billingAmount: unknown
  billingCurrency: string
  billingIpayOrderId: string | null
  billingIpayOrderNumber: string | null
  billingIpayAmountMinor: number | null
  billingIpayCurrency: number | null
}

function ascii(value: unknown, maxLength: number) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7D]/g, ' ')
    .replace(/[~\r\n]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizePhone(value: unknown) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = `40${digits.slice(1)}`
  return digits.slice(0, 15)
}

export function getPlatformIpayMerchant(): IpayMerchant {
  return {
    username: process.env.PLATFORM_IPAY_USERNAME || '',
    password: process.env.PLATFORM_IPAY_PASSWORD || '',
    live: process.env.PLATFORM_IPAY_IS_LIVE === 'true' || process.env.PLATFORM_IPAY_IS_LIVE === '1',
  }
}

export function isPlatformIpayConfigured() {
  const merchant = getPlatformIpayMerchant()
  return Boolean(merchant.username && merchant.password && process.env.APP_URL)
}

export function isActiveIpayAttempt(state: string | null, startedAt: Date | null, now = Date.now()) {
  return ACTIVE_IPAY_STATES.includes(String(state || '').toUpperCase() as typeof ACTIVE_IPAY_STATES[number])
    && Boolean(startedAt && now - startedAt.getTime() < IPAY_ATTEMPT_TTL_MS)
}

export function invoiceIdentity(business: BillingBusiness): IpayInvoiceIdentity {
  return {
    orderNumber: business.billingIpayOrderNumber,
    amountMinor: business.billingIpayAmountMinor,
    currency: business.billingIpayCurrency,
  }
}

export function validateIpayInvoice(business: BillingBusiness, ownerEmail?: string | null) {
  if (!isPlatformIpayConfigured()) throw new Error('Plata online prin BT iPay nu este configurată încă.')
  if (!business.billingInvoiceUrl || !business.billingInvoiceName) throw new Error('Factura nu a fost încărcată.')
  if (!['NEPLATIT', 'RESTANT'].includes(business.billingStatus)) throw new Error('Factura nu este disponibilă pentru plată.')
  if ((business.billingCurrency || 'RON').toUpperCase() !== 'RON') throw new Error('BT iPay este configurat pentru facturi în RON.')

  const amountMinor = amountToMinorUnits(Number(business.billingAmount))
  const invoiceReference = getInvoiceReference(business)
  const email = String(business.billingEmail || ownerEmail || '').trim().toLowerCase()
  const phone = normalizePhone(business.contactPhone)
  const contact = ascii(business.billingLegalName || business.name, 40)
  const city = ascii(business.billingCity, 50)
  const address = ascii(business.billingAddress, 50)
  if (!amountMinor) throw new Error('Factura nu are o sumă validă.')
  if (!invoiceReference) throw new Error('Factura nu are un identificator valid.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Completează un e-mail de facturare valid.')
  if (phone.length < 10) throw new Error('Completează telefonul business-ului înainte de plată.')
  if (contact.length < 3) throw new Error('Completează denumirea clientului în datele de facturare.')
  if (city.length < 2) throw new Error('Completează localitatea de facturare.')
  if (address.length < 5) throw new Error('Completează adresa de facturare.')
  return { amountMinor, invoiceReference, email, phone, contact, city, address }
}

export function newIpayOrderNumber(businessId: string) {
  return `BE${businessId.slice(-8)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`.slice(0, 32)
}

export async function createIpayInvoiceCheckout(
  business: BillingBusiness,
  orderNumber: string,
  payer: ReturnType<typeof validateIpayInvoice>,
) {
  const appUrl = process.env.APP_URL!.replace(/\/$/, '')
  const orderBundle = {
    orderCreationDate: new Date().toISOString().slice(0, 10),
    customerDetails: {
      email: payer.email,
      phone: payer.phone,
      contact: payer.contact,
      deliveryInfo: { deliveryType: 'serviciu', country: 642, city: payer.city, postAddress: payer.address },
      billingInfo: { country: 642, city: payer.city, postAddress: payer.address },
    },
  }
  return registerIpayPayment(getPlatformIpayMerchant(), {
    orderNumber,
    amount: payer.amountMinor,
    currency: IPAY_RON_CURRENCY,
    returnUrl: `${appUrl}/api/billing/ipay/finish/${encodeURIComponent(business.id)}`,
    description: ascii(`Abonament Bookeasy${business.planName ? ` - ${business.planName}` : ''} - ${business.billingInvoiceName}`, 512),
    email: payer.email,
    language: 'ro',
    pageView: 'MOBILE',
    orderBundle: JSON.stringify(orderBundle),
  })
}

export function getIpayInvoiceStatus(business: BillingBusiness) {
  if (!business.billingIpayOrderId) throw new Error('Factura nu are o tranzacție BT iPay asociată.')
  return getIpayOrderStatus(getPlatformIpayMerchant(), business.billingIpayOrderId)
}

export function getIpayInvoiceFinish(business: BillingBusiness, token: string) {
  if (!business.billingIpayOrderId) throw new Error('Factura nu are o tranzacție BT iPay asociată.')
  return getIpayFinishedPayment(getPlatformIpayMerchant(), business.billingIpayOrderId, token)
}

export function isIpayInvoiceConfirmed(status: Awaited<ReturnType<typeof getIpayInvoiceStatus>>, business: BillingBusiness) {
  return isIpayPaymentConfirmed(status, invoiceIdentity(business))
}

export function isIpayInvoiceTerminalFailure(status: Awaited<ReturnType<typeof getIpayInvoiceStatus>>, business: BillingBusiness) {
  return isIpayPaymentTerminalFailure(status, invoiceIdentity(business))
}
