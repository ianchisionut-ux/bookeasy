import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const { enabledByOwner } = await req.json()
  if (typeof enabledByOwner !== 'boolean') return NextResponse.json({ error: 'Valoare invalidă.' }, { status: 400 })

  // Proprietarul controlează doar canalele sale; superadminul indică explicit afacerea.
  const requestedBusinessId = req.nextUrl.searchParams.get('businessId')
  const businessId = (session as any).isSuperAdmin && requestedBusinessId
    ? requestedBusinessId
    : (session as any).businessId
  const channel = await prisma.channel.findUnique({ where: { id } })
  if (!businessId || !channel || channel.businessId !== businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.channel.update({ where: { id }, data: { enabledByOwner } })

  return NextResponse.json({ success: true })
}
