import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const optional = z.string().trim().max(200).optional()
const schema = z.object({
  billingClientType: z.enum(['PF', 'PJ']),
  billingLegalName: z.string().trim().min(2).max(200),
  billingCif: optional,
  billingRegCom: optional,
  billingAddress: z.string().trim().min(3).max(500),
  billingCounty: optional,
  billingCity: z.string().trim().min(2).max(100),
  billingPostalCode: z.string().trim().max(20).optional(),
  billingEmail: z.string().trim().email().max(200),
  contractRepresentativeName: z.string().trim().min(3).max(120),
  contractRepresentativeRole: z.string().trim().max(120).optional(),
}).superRefine((data, ctx) => {
  if (data.billingClientType === 'PJ' && !data.billingCif) ctx.addIssue({ code: 'custom', path: ['billingCif'], message: 'CUI/CIF este obligatoriu pentru persoana juridică.' })
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!session || !businessId || (session as any).role !== 'OWNER' || (session as any).isSuperAdmin) return NextResponse.json({ error: 'Acces permis doar titularului businessului.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Verifică datele juridice introduse.', details: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data
  await prisma.business.update({ where: { id: businessId }, data: {
    billingClientType: data.billingClientType,
    billingLegalName: data.billingLegalName,
    billingCif: data.billingCif || null,
    billingRegCom: data.billingClientType === 'PJ' ? data.billingRegCom || null : null,
    billingAddress: data.billingAddress,
    billingCounty: data.billingCounty || null,
    billingCity: data.billingCity,
    billingPostalCode: data.billingPostalCode || null,
    billingEmail: data.billingEmail,
    contractRepresentativeName: data.contractRepresentativeName,
    contractRepresentativeRole: data.contractRepresentativeRole || null,
  } })
  return NextResponse.json({ success: true })
}
