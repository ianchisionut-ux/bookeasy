import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; channelId: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id, channelId } = await params
  const channel = await prisma.channel.findFirst({ where: { id: channelId, businessId: id } })
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await prisma.channel.update({ where: { id: channelId }, data: { status: 'DISCONNECTED' } })

  return NextResponse.json({ success: true })
}
