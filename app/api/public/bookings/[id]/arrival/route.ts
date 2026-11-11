import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const reportSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().max(100000),
})

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = Math.PI / 180
  const dLat = (lat2 - lat1) * radians
  const dLon = (lon2 - lon1) * radians
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const limited = await rateLimit(`arrival:${getClientIp(req)}:${id}`, 24, 60_000)
  if (!limited.allowed) return NextResponse.json({ error: 'Prea multe verificări.' }, { status: 429 })

  const parsed = reportSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Date de locație invalide.' }, { status: 400 })

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, status: true, startAt: true, arrivalTokenHash: true,
      arrivalCandidateAt: true, arrivalLastSeenAt: true, arrivalSamples: true, arrivedAt: true,
      business: { select: { latitude: true, longitude: true } },
    },
  })
  if (!booking?.arrivalTokenHash || booking.business.latitude === null || booking.business.longitude === null) {
    return NextResponse.json({ error: 'Rezervarea nu permite verificarea sosirii.' }, { status: 404 })
  }

  const suppliedHash = createHash('sha256').update(parsed.data.token).digest()
  const expectedHash = Buffer.from(booking.arrivalTokenHash, 'hex')
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
    return NextResponse.json({ error: 'Rezervarea nu permite verificarea sosirii.' }, { status: 404 })
  }

  if (booking.arrivedAt) return NextResponse.json({ arrived: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  const now = new Date()
  const untilStartMs = booking.startAt.getTime() - now.getTime()
  if (!['PENDING', 'CONFIRMED'].includes(booking.status) || untilStartMs > 2 * 60 * 60_000 || untilStartMs < -15 * 60_000) {
    return NextResponse.json({ error: 'Verificarea sosirii nu este activă pentru această rezervare.' }, { status: 409 })
  }

  const { latitude, longitude, accuracy } = parsed.data
  const qualifying = accuracy <= 20 && distanceMeters(latitude, longitude, booking.business.latitude, booking.business.longitude) <= 10
  if (!qualifying) {
    if (booking.arrivalCandidateAt) {
      await prisma.booking.update({ where: { id }, data: { arrivalCandidateAt: null, arrivalLastSeenAt: null, arrivalSamples: 0 } })
    }
    return NextResponse.json({ arrived: false, qualifying: false }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const continuous = booking.arrivalCandidateAt && booking.arrivalLastSeenAt && now.getTime() - booking.arrivalLastSeenAt.getTime() <= 40_000
  const candidateAt = continuous ? booking.arrivalCandidateAt! : now
  const samples = continuous ? booking.arrivalSamples + 1 : 1
  const arrived = samples >= 5 && now.getTime() - candidateAt.getTime() >= 2 * 60_000
  await prisma.booking.update({
    where: { id },
    data: { arrivalCandidateAt: candidateAt, arrivalLastSeenAt: now, arrivalSamples: samples, ...(arrived ? { arrivedAt: now } : {}) },
  })
  return NextResponse.json({ arrived, qualifying: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
