import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots } from '@/lib/availability'

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId')
  const serviceId = req.nextUrl.searchParams.get('serviceId')
  const dateParam = req.nextUrl.searchParams.get('date') // 'YYYY-MM-DD'

  if (!businessId || !serviceId || !dateParam) {
    return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business || !business.publicListed) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const date = new Date(`${dateParam}T00:00:00`)
  const slots = await getAvailableSlots(businessId, serviceId, date)

  return NextResponse.json({ slots })
}
