import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { deleteR2File, putR2File, r2Url } from '@/lib/r2-storage'

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
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Alege o factură.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Factura depășește limita de 10 MB.' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Sunt acceptate PDF, JPG și PNG.' }, { status: 400 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'factura.pdf'
  try {
    const key = `invoices/${id}/${Date.now()}-${safeName}`
    await putR2File(key, file)
    await prisma.business.update({
      where: { id },
      data: { billingInvoiceUrl: r2Url(key), billingInvoiceName: file.name, billingInvoiceUploadedAt: new Date(), billingStatus: 'NEPLATIT', billingDueNotifiedAt: null },
    })
    if (business.billingInvoiceUrl) {
      await deleteR2File(business.billingInvoiceUrl).catch(() => {})
    }
  } catch (error) {
    console.error('Eroare upload factură:', error)
    return NextResponse.json({ error: 'Factura nu a putut fi încărcată în stocarea privată.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const business = await prisma.business.findUnique({ where: { id }, select: { billingInvoiceUrl: true } })
  if (!business) return NextResponse.json({ error: 'Business-ul nu există.' }, { status: 404 })
  if (!business.billingInvoiceUrl) return NextResponse.json({ success: true })

  try {
    await deleteR2File(business.billingInvoiceUrl)
    await prisma.business.update({
      where: { id },
      data: { billingInvoiceUrl: null, billingInvoiceName: null, billingInvoiceUploadedAt: null },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Eroare ștergere factură:', error)
    return NextResponse.json({ error: 'Factura nu a putut fi ștearsă.' }, { status: 500 })
  }
}
