import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/business-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ showServicePrices: z.boolean() }).strict()
export async function PATCH(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Opțiune invalidă.' }, { status: 400 })
  await prisma.business.update({ where: { id: businessId }, data: parsed.data })
  return NextResponse.json({ success: true })
}
