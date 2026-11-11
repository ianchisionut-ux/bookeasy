import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { selectGoogleLocation } from '@/lib/google-business-locations'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (!(session as any).isSuperAdmin && (session as any).role !== 'OWNER')) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'invalid origin' }, { status: 403 })
  const form = await req.formData()
  const id = String(form.get('connection') ?? '')
  try {
    const pending = await prisma.pendingGoogleConnection.findFirst({ where: { id, userId: (session as any).userId } })
    const businessId = (session as any).isSuperAdmin ? pending?.businessId : (session as any).businessId
    if (!businessId || !(await prisma.business.findFirst({ where: { id: businessId, accountActive: true } }))) throw new Error('Afacerea nu este disponibilă.')
    const redirectTo = await selectGoogleLocation(id, (session as any).userId, businessId, String(form.get('location') ?? ''))
    return NextResponse.redirect(new URL(`${redirectTo}?connected=google`, req.url), 303)
  } catch {
    const path = (session as any).isSuperAdmin ? '/superadmin/google-location' : '/dashboard/google-location'
    return NextResponse.redirect(new URL(`${path}?connection=${encodeURIComponent(id)}&error=${encodeURIComponent('Conectarea nu a putut fi finalizată. Reia conectarea sau alege o locație proprie.')}`, req.url), 303)
  }
}
