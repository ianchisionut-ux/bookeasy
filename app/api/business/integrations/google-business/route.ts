import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const actor = session as any
  if (!actor.isSuperAdmin && actor.role !== 'OWNER') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'invalid origin' }, { status: 403 })
  const requestedBusinessId = req.nextUrl.searchParams.get('businessId')
  if (!actor.isSuperAdmin && requestedBusinessId && requestedBusinessId !== actor.businessId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const businessId = actor.isSuperAdmin && requestedBusinessId ? requestedBusinessId : actor.businessId
  if (!businessId || !(await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }))) return NextResponse.json({ error: 'Afacerea nu a fost găsită.' }, { status: 404 })
  // Disconnect only this business's review integration. Keep saved reviews and
  // Calendar/sign-in grants; revoking a shared Google grant would affect them.
  const [removed] = await prisma.$transaction([
    prisma.channel.deleteMany({ where: { businessId, type: 'GOOGLE_BUSINESS' } }),
    prisma.pendingGoogleConnection.deleteMany({ where: { businessId } }),
  ])
  return NextResponse.json({ success: true, removed: removed.count }, { headers: { 'Cache-Control': 'no-store' } })
}
