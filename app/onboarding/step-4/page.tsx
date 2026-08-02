import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Step4Form from './step4-form'

export default async function OnboardingStep4() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) redirect('/login')

  // pasul de echipă are sens doar pentru saloane; spațiile de evenimente sar direct la pasul 5
  if (business.category === 'EVENT_VENUE') redirect('/onboarding/step-5')

  return <Step4Form />
}
