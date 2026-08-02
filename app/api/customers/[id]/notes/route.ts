import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { notes } = await req.json()

  // verificăm că clientul aparține business-ului din sesiune, ca să nu poată edita notițe pe alt cont
  const customer = await prisma.customer.findUnique({ where: { id: params.id } })
  if (!customer || customer.businessId !== (session as any).businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.customer.update({ where: { id: params.id }, data: { notes } })

  return NextResponse.json({ success: true })
}
