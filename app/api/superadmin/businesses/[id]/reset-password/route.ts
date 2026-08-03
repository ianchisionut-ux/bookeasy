import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createPasswordToken, sendPasswordSetupEmail } from '@/lib/password-tokens'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const owner = await prisma.user.findFirst({ where: { businessId, role: 'OWNER' } })
  if (!owner || !business) return NextResponse.json({ error: 'Nu există un cont owner pentru acest business.' }, { status: 404 })

  const token = await createPasswordToken(owner.id)
  try {
    await sendPasswordSetupEmail(owner.email, business.name, token)
  } catch (err) {
    console.error('Eroare trimitere email resetare (superadmin):', err)
    return NextResponse.json({ error: 'Emailul n-a putut fi trimis. Verifică RESEND_API_KEY.' }, { status: 500 })
  }

  return NextResponse.json({ email: owner.email })
}
