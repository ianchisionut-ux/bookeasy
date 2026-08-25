import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ enabled: z.boolean() })

export async function PATCH(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Valoare invalidă.' }, { status: 400 })

  const business = await prisma.business.update({
    where: { id: businessId },
    data: { botBookingEnabled: parsed.data.enabled },
    select: { botBookingEnabled: true },
  })

  return NextResponse.json({ success: true, enabled: business.botBookingEnabled })
}
