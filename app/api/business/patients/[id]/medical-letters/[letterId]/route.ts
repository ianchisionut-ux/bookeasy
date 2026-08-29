import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

async function ownsLetter(letterId: string, businessId: string) {
  const l = await prisma.medicalLetter.findUnique({ where: { id: letterId } })
  return l && l.businessId === businessId ? l : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; letterId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: customerId, letterId } = await params
  const owned = await ownsLetter(letterId, businessId)
  if (!owned || owned.customerId !== customerId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  // Relațiile și câmpurile de sistem nu pot fi mutate prin mass-assignment.
  const {
    id: _id,
    businessId: _businessId,
    business: _business,
    customerId: _customerId,
    customer: _customer,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = body
  const letter = await prisma.medicalLetter.update({ where: { id: letterId }, data })
  return NextResponse.json({ letter })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; letterId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: customerId, letterId } = await params
  const owned = await ownsLetter(letterId, businessId)
  if (!owned || owned.customerId !== customerId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await prisma.medicalLetter.delete({ where: { id: letterId } })
  return NextResponse.json({ success: true })
}
