import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const owner = await prisma.user.findFirst({ where: { businessId, role: 'OWNER' } })
  if (!owner) return NextResponse.json({ error: 'Nu există un cont owner pentru acest business.' }, { status: 404 })

  // parolă temporară — afișată o singură dată în UI, admin trebuie s-o transmită owner-ului
  const newPassword = crypto.randomBytes(6).toString('base64url')
  const hashed = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({ where: { id: owner.id }, data: { password: hashed } })

  return NextResponse.json({ email: owner.email, newPassword })
}
