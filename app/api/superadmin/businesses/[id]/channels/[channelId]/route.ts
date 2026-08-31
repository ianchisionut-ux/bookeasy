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

  // Interfata trateaza fiecare tip ca o singura integrare. Eliminam toate intrarile
  // de acelasi tip ca sa nu ramana ACTIVE o a doua Pagina salvata accidental.
  const channels = await prisma.channel.findMany({
    where: { businessId: id, type: channel.type },
  })

  const warnings = (
    await Promise.all(
      channels.map(async (currentChannel) => {
        if (currentChannel.type === 'FACEBOOK') {
          return unsubscribeFromMeta(currentChannel.externalId, currentChannel.accessToken)
        }
        if (currentChannel.type === 'WHATSAPP' && currentChannel.wabaId) {
          return unsubscribeFromMeta(currentChannel.wabaId, currentChannel.accessToken)
        }
        return null
      })
    )
  ).filter((warning): warning is string => Boolean(warning))

  // Stergerea elimina toate tokenurile locale si permite o inrolare curata ulterioara.
  const deleted = await prisma.channel.deleteMany({
    where: { businessId: id, type: channel.type },
  })

  return NextResponse.json({
    success: true,
    removed: deleted.count,
    warning: warnings.length > 0 ? [...new Set(warnings)].join(' | ') : null,
  })
}
