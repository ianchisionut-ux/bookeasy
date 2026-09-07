import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { createSignalInvoice } from '@/lib/signal-billing'
import { ensureSignalBillingSchema } from '@/lib/signal-billing-schema'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin)
    return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const { id } = await params
  const { allowed } = rateLimit(`signal-invoice:${id}`, 10, 60 * 60 * 1000)
  if (!allowed)
    return NextResponse.json({ error: 'Prea multe încercări. Reîncearcă mai târziu.' }, { status: 429 })

  try {
    await ensureSignalBillingSchema()
    let business = await prisma.business.findUnique({ where: { id } })
    if (!business) return NextResponse.json({ error: 'Business-ul nu există.' }, { status: 404 })
    if (business.billingInvoiceUrl)
      return NextResponse.json({ error: 'Există deja o factură pentru ciclul curent.' }, { status: 409 })
    if (!business.billingSubtotal || Number(business.billingSubtotal) <= 0 || !business.billingDueAt)
      return NextResponse.json({ error: 'Completează valoarea fără TVA și scadența.' }, { status: 400 })
    if (!business.billingLegalName || !business.billingAddress || !business.billingCounty || !business.billingCity)
      return NextResponse.json({ error: 'Completează datele de facturare ale clientului.' }, { status: 400 })
    if (business.billingClientType === 'PJ' && !business.billingCif)
      return NextResponse.json({ error: 'CIF-ul este obligatoriu pentru persoana juridică.' }, { status: 400 })

    if (!business.billingInvoiceExternalId) {
      const externalId = `subscription-${business.id}-${randomUUID()}`
      await prisma.business.updateMany({
        where: { id, billingInvoiceExternalId: null },
        data: { billingInvoiceExternalId: externalId },
      })
      business = await prisma.business.findUnique({ where: { id } })
      if (!business?.billingInvoiceExternalId) throw new Error('Identificatorul facturii nu a putut fi rezervat.')
    }

    const vatRate = Number(business.billingVatRate)
    if (![0, 5, 9, 11, 19, 21].includes(vatRate))
      return NextResponse.json({ error: 'Cota TVA configurată nu este acceptată.' }, { status: 400 })
    const result = await createSignalInvoice({
      externalId: business.billingInvoiceExternalId,
      dueDate: business.billingDueAt!.toISOString().slice(0, 10),
      currency: business.billingCurrency || 'RON',
      notes: `Abonament Bookeasy${business.planName ? ` — plan ${business.planName}` : ''}`,
      customer: {
        externalId: business.id,
        type: business.billingClientType,
        name: business.billingLegalName,
        cif: business.billingClientType === 'PJ' ? business.billingCif || '' : '',
        cnp: business.billingClientType === 'PF' ? business.billingCif || '' : '',
        regCom: business.billingRegCom || '',
        address: business.billingAddress,
        county: business.billingCounty,
        city: business.billingCity,
        postalCode: business.billingPostalCode || '',
        email: business.billingEmail || '',
        countryCode: 'RO',
      },
      items: [{
        description: `Abonament Bookeasy${business.planName ? ` — ${business.planName}` : ''}`,
        um: 'buc',
        unitCode: 'H87',
        qty: 1,
        unitPrice: Number(business.billingSubtotal),
        vatRate,
        vatCategoryCode: vatRate > 0 ? 'S' : 'O',
        taxExemptionReason: vatRate > 0 ? '' : 'Emitent neînregistrat în scopuri de TVA.',
      }],
    })

    await prisma.business.update({
      where: { id },
      data: {
        billingAmount: result.total,
        billingInvoiceUrl: `signal:${result.externalId}`,
        billingInvoiceName: `${result.reference.replace(/\s+/g, '_')}.pdf`,
        billingInvoiceUploadedAt: new Date(),
        billingStatus: 'NEPLATIT',
        billingDueNotifiedAt: null,
      },
    })
    return NextResponse.json({ success: true, reference: result.reference, total: result.total, duplicate: result.duplicate })
  } catch (error) {
    console.error('Eroare emitere factură Signal:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Factura nu a putut fi emisă.' }, { status: 502 })
  }
}
