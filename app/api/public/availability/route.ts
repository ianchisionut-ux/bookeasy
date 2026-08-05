import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots } from '@/lib/availability'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`public-availability:${ip}`, 60, 60 * 1000) // 60/minut/IP — generos pt navigare normală
  if (!allowed) {
    return NextResponse.json({ error: 'Prea multe cereri. Așteaptă puțin.' }, { status: 429 })
  }

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
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  if (date < todayStart) {
    return NextResponse.json({ slots: [] })
  }

  const slots = await getAvailableSlots(businessId, serviceId, date)

  return NextResponse.json({ slots })
}
