import { NextRequest } from 'next/server'
import { getIpayInvoiceFinish, isPlatformIpayConfigured } from '@/lib/billing-ipay'
import { loadIpayBusiness, reconcileIpayBusiness } from '@/lib/billing-ipay-reconciliation'

const RETRY_DELAYS_MS = [0, 250, 750, 1500]

export async function GET(req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const orderId = String(req.nextUrl.searchParams.get('orderId') || '')
  const token = String(req.nextUrl.searchParams.get('token') || '')
  let business = await loadIpayBusiness(businessId)
  if (
    !business ||
    !isPlatformIpayConfigured() ||
    !/^[a-f0-9-]{36}$/i.test(orderId) ||
    !token || token.length > 512 ||
    orderId !== business.billingIpayOrderId
  ) return resultPage(false, 'Plata nu a putut fi identificată.')

  if (business.billingStatus === 'PLATIT' && business.billingIpayPaymentState === 'DEPOSITED') {
    return resultPage(true, 'Factura este deja plătită.')
  }

  try {
    // Răspunsul autentificat server-la-server rămâne autoritatea financiară. Endpoint-ul
    // de finish validează token-ul de retur, dar câmpurile lui opționale nu pot confirma plata.
    await getIpayInvoiceFinish(business, token).catch(() => null)
    for (const delayMs of RETRY_DELAYS_MS) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
      business = await loadIpayBusiness(businessId)
      const state = await reconcileIpayBusiness(business)
      if (state === 'confirmed') return resultPage(true, 'Factura Bookeasy a fost plătită cu succes.')
      if (state === 'declined') return resultPage(false, 'Plata a fost refuzată. Poți reveni în cont și încerca din nou.')
      if (state === 'stale') return resultPage(false, 'Factura s-a modificat și plata nu poate fi asociată documentului curent.')
    }
    return pendingPage(req.nextUrl.pathname + req.nextUrl.search)
  } catch (error) {
    console.error(`[billing-ipay:${businessId}] Verificarea plății a eșuat:`, error instanceof Error ? error.message : error)
    return pendingPage(req.nextUrl.pathname + req.nextUrl.search)
  }
}

function html(message: string, color: string, icon: string) {
  const escaped = message.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plată factură Bookeasy</title></head><body style="margin:0;font-family:system-ui;background:#f4f5f8;min-height:100vh;display:grid;place-items:center;padding:20px;box-sizing:border-box"><main style="background:#fff;border-radius:18px;padding:38px 30px;max-width:460px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.08)"><div style="font-size:48px">${icon}</div><h1 style="font-size:22px;color:${color}">${escaped}</h1><a href="/dashboard/setari" style="display:inline-block;margin-top:12px;padding:13px 22px;border-radius:12px;background:#639922;color:#fff;font-weight:800;text-decoration:none">Înapoi în Bookeasy</a></main></body></html>`
}

function response(body: string, status: number, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

function resultPage(ok: boolean, message: string) {
  return response(html(message, ok ? '#087443' : '#b42318', ok ? '✓' : '✕'), ok ? 200 : 400)
}

function pendingPage(retryUrl: string) {
  const safeRetryUrl = retryUrl.replace(/[\u0000-\u001f\u007f]/g, '')
  return response(
    html('Banca procesează confirmarea. Pagina se verifică din nou automat.', '#172033', '⏳'),
    202,
    { Refresh: `3; url=${safeRetryUrl}` },
  )
}
