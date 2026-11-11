import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { decrypt, encrypt } from '@/lib/crypto'
import { assertChannelOwnership, ChannelOwnershipError, saveBusinessChannel } from '@/lib/business-channel-connection'
import { manualChannelSchema, verifyManualChannel } from '@/lib/manual-integrations'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'invalid origin' }, { status: 403 })
  const { id: businessId } = await params
  if (!await prisma.business.findFirst({ where: { id: businessId, accountActive: true }, select: { id: true } })) return NextResponse.json({ error: 'Afacerea nu există sau este inactivă.' }, { status: 404 })
  const parsed = manualChannelSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Date invalide.' }, { status: 400 })
  const input = parsed.data
  try {
    await assertChannelOwnership(businessId, input.type, input.externalId)
    const existing = await prisma.channel.findUnique({ where: { type_externalId: { type: input.type, externalId: input.externalId } } })
    const token = input.accessToken || (existing?.businessId === businessId ? decrypt(existing.accessToken) : '')
    if (!token) return NextResponse.json({ error: 'Access token este obligatoriu la prima conectare a acestui cont.' }, { status: 400 })
    const verified = await verifyManualChannel(input, token)
    await saveBusinessChannel(businessId, input.type, input.externalId, {
      ...verified, accessToken: encrypt(token),
      ...(input.refreshToken ? { refreshToken: encrypt(input.refreshToken) } : {}),
      ...(input.type === 'WHATSAPP' ? { wabaId: input.wabaId! } : {}),
      expiresAt: input.type === 'GOOGLE_BUSINESS' ? input.accessToken ? new Date(Date.now() + input.expiresInMinutes * 60000) : existing?.expiresAt ?? new Date(Date.now() + input.expiresInMinutes * 60000) : input.accessToken ? null : existing?.expiresAt,
    })
    await prisma.channel.updateMany({ where: { businessId, type: input.type, externalId: { not: input.externalId } }, data: { status: 'DISCONNECTED', enabledByOwner: false } })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Never log provider responses or plaintext credentials.
    if (error instanceof ChannelOwnershipError) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Configurarea manuală nu a putut fi verificată.' }, { status: 400 })
  }
}
