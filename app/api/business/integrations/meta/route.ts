import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { disconnectBusinessChannel } from '@/lib/disconnect-business-channel'

export async function DELETE() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const instagram = await disconnectBusinessChannel(businessId, 'INSTAGRAM')
  const facebook = await disconnectBusinessChannel(businessId, 'FACEBOOK')
  return NextResponse.json({ success: true, removed: instagram.removed + facebook.removed, warning: [instagram.warning, facebook.warning].filter(Boolean).join(' ') || null })
}
