import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const toothStatus = z.enum(['HEALTHY', 'WATCH', 'CARIES', 'FILLED', 'CROWN', 'ROOT_CANAL', 'IMPLANT', 'MISSING'])
const historyItem = z.object({
  at: z.string().datetime(),
  status: toothStatus,
  treatment: z.string().max(500),
  note: z.string().max(2000),
})
const toothEntry = z.object({
  status: toothStatus,
  treatment: z.string().max(500),
  note: z.string().max(2000),
  treatmentDate: z.string().max(10),
  updatedAt: z.string().datetime(),
  history: z.array(historyItem).max(100),
})
const chartSchema = z.object({
  version: z.literal(1),
  teeth: z.record(z.string().regex(/^[1-4][1-8]$/), toothEntry).refine((teeth) => Object.keys(teeth).length <= 32),
  generalNotes: z.string().max(5000),
  updatedAt: z.string().datetime(),
})

async function context(customerId: string, businessId: string) {
  const [business, customer] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true, dentalClinic: true } }),
    prisma.customer.findFirst({ where: { id: customerId, businessId }, select: { id: true } }),
  ])
  return business?.category === 'CLINICA' && business.dentalClinic && customer ? customer : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  if (!(await context(id, businessId))) return NextResponse.json({ error: 'Modulul stomatologic nu este activ.' }, { status: 403 })
  const record = await prisma.patientMedicalRecord.findUnique({ where: { customerId: id }, select: { dentalHistory: true } })
  return NextResponse.json({ chart: record?.dentalHistory ?? null })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  if (!(await context(id, businessId))) return NextResponse.json({ error: 'Modulul stomatologic nu este activ.' }, { status: 403 })

  const parsed = chartSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele odontogramei sunt invalide.', details: parsed.error.flatten() }, { status: 400 })
  const dentalHistory = parsed.data as Prisma.InputJsonValue
  await prisma.patientMedicalRecord.upsert({
    where: { customerId: id },
    create: { customerId: id, dentalHistory },
    update: { dentalHistory },
  })
  return NextResponse.json({ success: true, chart: parsed.data })
}
