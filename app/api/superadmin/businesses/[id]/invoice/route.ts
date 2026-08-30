import { NextRequest, NextResponse } from 'next/server'
import { del, put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const business = await prisma.business.findUnique({ where: { id }, select: { billingInvoiceUrl: true } })
  if (!business) return NextResponse.json({ error: 'Business-ul nu există.' }, { status: 404 })
  const { allowed } = rateLimit(`invoice-upload:${id}`, 20, 60 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Prea multe încărcări. Încearcă mai târziu.' }, { status: 429 })
  if (!process.env.DOCMED_STORE_ID) {
    return NextResponse.json({ error: 'Stocarea facturilor nu este configurată.' }, { status: 503 })
  }
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Alege o factură.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Factura depășește limita de 10 MB.' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Sunt acceptate PDF, JPG și PNG.' }, { status: 400 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'factura.pdf'
  try {
    const blob = await put(`invoices/${id}/${Date.now()}-${safeName}`, file, {
      access: 'private', storeId: process.env.DOCMED_STORE_ID,
      addRandomSuffix: true, contentType: file.type, cacheControlMaxAge: 60,
    })
    await prisma.business.update({
      where: { id },
      data: { billingInvoiceUrl: blob.url, billingInvoiceName: file.name, billingInvoiceUploadedAt: new Date(), billingStatus: 'NEPLATIT', billingDueNotifiedAt: null },
    })
    if (business.billingInvoiceUrl) {
      try { await del(business.billingInvoiceUrl, { storeId: process.env.DOCMED_STORE_ID }) } catch {}
    }
  } catch (error) {
    console.error('Eroare upload factură:', error)
    return NextResponse.json({ error: 'Factura nu a putut fi încărcată în stocarea privată.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
