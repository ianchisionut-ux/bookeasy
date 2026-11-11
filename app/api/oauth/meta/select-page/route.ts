import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { selectMetaPage, MetaConnectionError } from '@/lib/business-meta'

export async function POST(req: NextRequest) {
  const session = await auth()
  const actor = session as any
  if (!session || (!actor.isSuperAdmin && actor.role !== 'OWNER')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'invalid origin' }, { status: 403 })
  const form = await req.formData()
  const id = String(form.get('connection') ?? '')
  try {
    const pending = await prisma.pendingMetaConnection.findFirst({ where: { id, userId: actor.userId, expiresAt: { gt: new Date() } }, select: { businessId: true } })
    const businessId = actor.isSuperAdmin ? pending?.businessId : actor.businessId
    if (!pending || !businessId || !(await prisma.business.findFirst({ where: { id: businessId, accountActive: true }, select: { id: true } }))) throw new MetaConnectionError('selection', 'Afacerea nu este disponibilă sau alegerea a expirat.')
    const result = await selectMetaPage(id, actor.userId, businessId, String(form.get('page') ?? ''))
    return NextResponse.redirect(new URL(`${result.redirectTo}?connected=${result.connected}`, req.url), 303)
  } catch (error) {
    const known = error instanceof MetaConnectionError
    console.error('[business-meta-select]', { stage: known ? error.stage : 'save_connection', status: known ? error.status : undefined, code: known ? error.code : undefined })
    const message = known ? error.message : 'Conectarea nu a putut fi salvată. Reîncearcă sau contactează echipa BookEasy.'
    const path = actor.isSuperAdmin ? '/superadmin/meta-page' : '/dashboard/meta-page'
    return NextResponse.redirect(new URL(`${path}?connection=${encodeURIComponent(id)}&error=${encodeURIComponent(message)}`, req.url), 303)
  }
}
