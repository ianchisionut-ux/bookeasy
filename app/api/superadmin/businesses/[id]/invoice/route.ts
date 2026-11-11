import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { deleteR2File, putR2File, r2Url } from '@/lib/r2-storage'
import { resetIpayPaymentFields } from '@/lib/billing-ipay'
import { lockLaunchBusiness, refreshLaunchIfDue } from '@/lib/launch-campaign'

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  await refreshLaunchIfDue(id)
  const business = await prisma.business.findUnique({ where: { id }, select: { billingInvoiceUrl: true, billingDueAt: true, billingAmount: true } })
  if (!business) return NextResponse.json({ error: 'Business-ul nu există.' }, { status: 404 })
  const enrollment = await prisma.launchEnrollment.findUnique({ where: { businessId: id } })
  const managed = Boolean(enrollment && !enrollment.cancelledAt)
  if (managed && !Number(business.billingAmount)) return NextResponse.json({ error: 'Nu este necesară o factură pentru perioada gratuită.' }, { status: 400 })
  if (business.billingInvoiceUrl?.startsWith('signal:')) return NextResponse.json({ error: 'Factura fiscală emisă în Signal nu poate fi înlocuită.' }, { status: 409 })
  const { allowed } = await rateLimit(`invoice-upload:${id}`, 20, 60 * 60 * 1000)
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
    await prisma.$transaction(async tx => {
    await lockLaunchBusiness(tx, id)
    const fresh = await tx.business.findUniqueOrThrow({ where: { id } })
    const freshEnrollment = await tx.launchEnrollment.findUnique({ where: { businessId: id } })
    if (fresh.billingInvoiceUrl !== business.billingInvoiceUrl || fresh.billingDueAt?.getTime() !== business.billingDueAt?.getTime() || freshEnrollment?.billingCycle !== enrollment?.billingCycle) throw new Error('Perioada de facturare s-a schimbat. Reîncarcă pagina înainte de încărcare.')
    await tx.business.update({
      where: { id },
      data: { billingInvoiceUrl: r2Url(key), billingInvoiceName: file.name, billingInvoiceUploadedAt: new Date(), billingInvoiceExternalId: null, ...(!managed ? { billingStatus: 'NEPLATIT' as const, billingPaidAt: null } : {}), billingDueNotifiedAt: null, billingStripeCheckoutSessionId: null, billingStripePaymentIntentId: null, ...resetIpayPaymentFields() },
    })
    if (managed && enrollment!.billingCycle !== null) await tx.launchBillingPeriod.update({ where: { enrollmentId_cycle: { enrollmentId: enrollment!.id, cycle: enrollment!.billingCycle } }, data: { invoiceUrl: r2Url(key), invoiceName: file.name, invoiceExternalId: null } })
    })
    if (business.billingInvoiceUrl) {
      const references = await prisma.launchBillingPeriod.count({ where: { invoiceUrl: business.billingInvoiceUrl } })
      if (!references) await deleteR2File(business.billingInvoiceUrl).catch(() => {})
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
  if (business.billingInvoiceUrl.startsWith('signal:')) {
    return NextResponse.json({ error: 'Factura fiscală emisă în Signal nu poate fi ștearsă. Pentru corecții folosește storno în Signal.' }, { status: 409 })
  }

  try {
    await prisma.$transaction(async tx => {
    await lockLaunchBusiness(tx, id)
    const enrollment = await tx.launchEnrollment.findUnique({ where: { businessId: id } })
    const managed = Boolean(enrollment && !enrollment.cancelledAt)
    await tx.business.updateMany({
      where: { id, billingInvoiceUrl: business.billingInvoiceUrl },
      data: { billingInvoiceUrl: null, billingInvoiceName: null, billingInvoiceUploadedAt: null, billingStripeCheckoutSessionId: null, billingStripePaymentIntentId: null, ...(!managed ? { billingPaidAt: null } : {}), ...resetIpayPaymentFields() },
    })
    if (managed && enrollment!.billingCycle !== null) await tx.launchBillingPeriod.updateMany({ where: { enrollmentId: enrollment!.id, cycle: enrollment!.billingCycle, invoiceUrl: business.billingInvoiceUrl }, data: { invoiceUrl: null, invoiceName: null, invoiceExternalId: null } })
    })
    const references = await prisma.launchBillingPeriod.count({ where: { invoiceUrl: business.billingInvoiceUrl } })
    if (!references) await deleteR2File(business.billingInvoiceUrl)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Eroare ștergere factură:', error)
    return NextResponse.json({ error: 'Factura nu a putut fi ștearsă.' }, { status: 500 })
  }
}
