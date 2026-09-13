export type InvoiceIdentity = {
  billingInvoiceExternalId: string | null
  billingInvoiceUploadedAt: Date | null
}

export function getInvoiceReference(invoice: InvoiceIdentity) {
  if (invoice.billingInvoiceExternalId) return invoice.billingInvoiceExternalId
  if (invoice.billingInvoiceUploadedAt) return `upload:${invoice.billingInvoiceUploadedAt.toISOString()}`
  return null
}

export function amountToMinorUnits(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const minorUnits = Math.round((amount + Number.EPSILON) * 100)
  return Number.isSafeInteger(minorUnits) && minorUnits > 0 ? minorUnits : null
}
