import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.enum(['SALON', 'EVENT_VENUE']).optional(),
  publicListed: z.boolean().optional(),
  accountActive: z.boolean().optional(),
})

async function requireSuperAdmin() {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await prisma.business.update({ where: { id }, data: parsed.data })

  return NextResponse.json({ success: true })
}

// Ștergere definitivă — curăță manual toate relațiile, pentru că nu avem
// onDelete: Cascade setat în schema (evităm ștergeri accidentale în lanț la alte operații)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: businessId } = await params

  await prisma.$transaction([
    prisma.missedMessageAlert.deleteMany({ where: { businessId } }),
    prisma.review.deleteMany({ where: { businessId } }),
    prisma.conversation.deleteMany({ where: { businessId } }),
    prisma.booking.deleteMany({ where: { businessId } }),
    prisma.customer.deleteMany({ where: { businessId } }),
    prisma.service.deleteMany({ where: { businessId } }),
    prisma.resource.deleteMany({ where: { businessId } }),
    prisma.staff.deleteMany({ where: { businessId } }),
    prisma.workingHours.deleteMany({ where: { businessId } }),
    prisma.channel.deleteMany({ where: { businessId } }),
    prisma.subscription.deleteMany({ where: { businessId } }),
    prisma.user.deleteMany({ where: { businessId } }),
    prisma.business.delete({ where: { id: businessId } }),
  ])

  return NextResponse.json({ success: true })
}
