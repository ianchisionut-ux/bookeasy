import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InboxManager from './inbox-manager'
import { prisma } from '@/lib/prisma'
import { isAppointmentCategory, isPatientCategory } from '@/lib/business-categories'

export default async function MesajePage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { category: true } })
  const isClinic = isPatientCategory(business?.category)
  const isAppointmentBased = isAppointmentCategory(business?.category)
  return <InboxManager businessId={businessId} category={business?.category ?? 'SALON'} isClinic={isClinic} isAppointmentBased={isAppointmentBased} />
}
