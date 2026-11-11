import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { disconnectBusinessChannel } from '@/lib/disconnect-business-channel'
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id } = await params
  const selected = await prisma.channel.findFirst({ where: { id, businessId } })
  if (!selected || !['FACEBOOK', 'INSTAGRAM', 'WHATSAPP'].includes(selected.type)) return NextResponse.json({ error: 'Integrarea nu a fost găsită.' }, { status: 404 })
  return NextResponse.json(await disconnectBusinessChannel(businessId, selected.type as 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP'))
}
