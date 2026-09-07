import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getR2File, r2Key } from '@/lib/r2-storage'
import { downloadSignalInvoice } from '@/lib/signal-billing'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const session = await auth()
  const { businessId } = await params
  if (!session || (!(session as any).isSuperAdmin && (session as any).businessId !== businessId)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { billingInvoiceUrl: true, billingInvoiceName: true } })
  if (!business?.billingInvoiceUrl) return NextResponse.json({ error: 'Factura nu există.' }, { status: 404 })
  if (business.billingInvoiceUrl.startsWith('signal:')) {
    try {
      const response = await downloadSignalInvoice(business.billingInvoiceUrl.slice('signal:'.length))
      return new NextResponse(response.body, { headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura"; filename*=UTF-8''${encodeURIComponent(business.billingInvoiceName || 'factura.pdf')}`,
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
      } })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Factura nu a putut fi descărcată.' }, { status: 502 })
    }
  }
  const key = r2Key(business.billingInvoiceUrl)
  if (!key) return NextResponse.json({ error: 'Factura trebuie migrată în Cloudflare R2.' }, { status: 409 })
  const object = await getR2File(key)
  if (!object) return NextResponse.json({ error: 'Factura nu a fost găsită.' }, { status: 404 })
  return new NextResponse(object.body, { headers: {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="factura"; filename*=UTF-8''${encodeURIComponent(business.billingInvoiceName || 'factura')}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
  } })
}
