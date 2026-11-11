import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/business-auth'
import { z } from 'zod'
import { canonicalCustomerPhone } from '@/lib/customer-phone'
import { findCustomerByPhone } from '@/lib/customer-lookup'

const schema = z.object({
  name: z.string().optional(),
  phone: z.string().min(3).transform(canonicalCustomerPhone).optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  dateOfBirth: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId

  const customer = await prisma.customer.findUnique({ where: { id } })
  if (!customer || customer.businessId !== businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: `Verifică ${parsed.error.issues[0]?.path.join('.') || 'datele introduse'}: ${parsed.error.issues[0]?.message || 'valoare invalidă'}.` }, { status: 400 })

  // telefonul e cheia de identificare a clientului pe WhatsApp — dacă se schimbă,
  // verificăm că nu intră în conflict cu alt client existent al aceluiași business
  if (parsed.data.phone && parsed.data.phone !== customer.phone) {
    const conflict = await findCustomerByPhone(businessId, parsed.data.phone)
    if (conflict && conflict.id !== id) {
      return NextResponse.json({ error: 'Există deja un client cu acest număr de telefon.' }, { status: 409 })
    }
  }

  const { dateOfBirth, ...rest } = parsed.data
  await prisma.customer.update({
    where: { id },
    data: { ...rest, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : dateOfBirth === '' ? null : undefined },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const businessId = (session as any).businessId
  const result = await prisma.customer.updateMany({
    where: { id, businessId, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (!result.count) return NextResponse.json({ error: 'Clientul nu a fost găsit.' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const businessId = (session as any).businessId
  const result = await prisma.customer.updateMany({
    where: { id, businessId, archivedAt: { not: null } },
    data: { archivedAt: null },
  })
  if (!result.count) return NextResponse.json({ error: 'Clientul nu a fost găsit.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
