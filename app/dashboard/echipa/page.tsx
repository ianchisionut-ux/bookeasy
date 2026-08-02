import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StaffManager from './staff-manager'

export default async function EchipaPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { staff: { orderBy: { name: 'asc' }, include: { _count: { select: { bookings: true } } } } },
  })
  if (!business) redirect('/login')

  if (business.category !== 'SALON') redirect('/dashboard/servicii')

  return (
    <StaffManager
      staff={business.staff.map((s) => ({ id: s.id, name: s.name, active: s.active, bookingsCount: s._count.bookings }))}
    />
  )
}
