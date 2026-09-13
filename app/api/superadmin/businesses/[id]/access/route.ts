import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SUPERADMIN_BUSINESS_COOKIE } from '@/lib/superadmin-business-access'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) {
    return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  }

  const { id } = await params
  const business = await prisma.business.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!business) return NextResponse.json({ error: 'Business-ul nu există.' }, { status: 404 })

  const response = NextResponse.json({ ok: true, redirectTo: '/dashboard/calendar', businessName: business.name })
  response.cookies.set(SUPERADMIN_BUSINESS_COOKIE, business.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}

export async function DELETE() {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) {
    return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, redirectTo: '/superadmin/afaceri' })
  response.cookies.set(SUPERADMIN_BUSINESS_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
