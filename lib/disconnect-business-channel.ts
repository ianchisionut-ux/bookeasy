import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export async function disconnectBusinessChannel(businessId: string, type: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP') {
  const channels = await prisma.channel.findMany({ where: { businessId, type } })
  await prisma.channel.deleteMany({ where: { businessId, type, id: { in: channels.map(c => c.id) } } })
  const subscriptions = new Map<string, { token: string; objectId: string; provider: string }>()
  for (const c of channels) {
    const objectId = c.type === 'WHATSAPP' ? c.wabaId : c.externalId
    if (objectId) subscriptions.set(`${c.authProvider}:${objectId}`, { objectId, token: c.accessToken, provider: c.authProvider })
  }
  const warnings: string[] = []
  for (const { objectId, token, provider } of subscriptions.values()) {
    if (type === 'WHATSAPP' && await prisma.channel.findFirst({ where: { type: 'WHATSAPP', wabaId: objectId }, select: { id: true } })) continue
    const url = type === 'INSTAGRAM' && provider === 'instagram'
      ? 'https://graph.instagram.com/v26.0/me/subscribed_apps'
      : `https://graph.facebook.com/v21.0/${encodeURIComponent(objectId)}/subscribed_apps`
    try {
      const response = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${decrypt(token)}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.error || result.success !== true) warnings.push('Meta nu a confirmat dezabonarea. Canalul este oprit în BookEasy.')
    } catch { warnings.push('Meta nu a putut fi contactat. Canalul este oprit în BookEasy.') }
  }
  return { success: true, removed: channels.length, warning: warnings.length ? [...new Set(warnings)].join(' ') : null }
}
