import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0'

async function unsubscribeFromMeta(objectId: string, encryptedToken: string) {
  try {
    const response = await fetch(`${META_GRAPH_URL}/${encodeURIComponent(objectId)}/subscribed_apps`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${decrypt(encryptedToken)}` },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.error || data?.success === false) {
      return data?.error?.message ?? 'Meta nu a confirmat dezabonarea webhook-ului.'
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'Meta nu a putut fi contactat pentru dezabonare.'
  }
  return null
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; channelId: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id, channelId } = await params
  const channel = await prisma.channel.findFirst({ where: { id: channelId, businessId: id } })
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let warning: string | null = null

  if (channel.type === 'FACEBOOK') {
    warning = await unsubscribeFromMeta(channel.externalId, channel.accessToken)
  } else if (channel.type === 'WHATSAPP' && channel.wabaId) {
    warning = await unsubscribeFromMeta(channel.wabaId, channel.accessToken)
  }

  // Stergerea canalului elimina tokenul din BookEasy si permite o inrolare curata ulterioara.
  await prisma.channel.delete({ where: { id: channelId } })

  return NextResponse.json({ success: true, warning })
}
