import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const schema = z.object({
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, string> = {}
  if (parsed.data.stripeSecretKey) data.stripeSecretKey = encrypt(parsed.data.stripeSecretKey)
  if (parsed.data.stripeWebhookSecret) data.stripeWebhookSecret = encrypt(parsed.data.stripeWebhookSecret)

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true, note: 'nimic de actualizat' })
  }

  await prisma.business.update({ where: { id: businessId }, data })
  return NextResponse.json({ success: true })
}
