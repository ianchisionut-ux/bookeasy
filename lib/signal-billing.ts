type SignalInvoiceResult = {
  id: number
  reference: string
  externalId: string
  status: string
  total: number
  currency: string
  duplicate: boolean
  pdfUrl: string
}

function configuration() {
  const url = process.env.SIGNAL_BILLING_API_URL?.trim()
  const key = process.env.SIGNAL_BILLING_API_KEY?.trim()
  if (!url || !key) throw new Error('Integrarea Signal nu este configurată.')
  return { url, key }
}

export async function createSignalInvoice(payload: Record<string, unknown>): Promise<SignalInvoiceResult> {
  const { url, key } = configuration()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const data = await response.json().catch(() => ({})) as Partial<SignalInvoiceResult> & { error?: string }
  if (!response.ok) throw new Error(data.error || `Signal a răspuns cu eroarea ${response.status}.`)
  if (!data.externalId || !data.reference || !data.pdfUrl || !Number.isFinite(Number(data.total)))
    throw new Error('Signal a returnat un răspuns incomplet.')
  return data as SignalInvoiceResult
}

export async function downloadSignalInvoice(externalId: string) {
  const { url, key } = configuration()
  const endpoint = new URL(url)
  endpoint.searchParams.set('externalId', externalId)
  endpoint.searchParams.set('format', 'pdf')
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error || `Factura nu a putut fi descărcată din Signal (${response.status}).`)
  }
  return response
}
