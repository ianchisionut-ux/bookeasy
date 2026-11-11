import { privateJson } from '@/lib/private-json'
import { claimNextSms } from '@/lib/sms-limits'
import { NextRequest } from 'next/server';
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authenticateSmsDevice, updateSmsDevice } from '@/lib/sms-device-auth'
import { matchesSmsSim } from '@/lib/sms-policy'

async function verifySim(req: NextRequest, business: { id: string; smsGatewayPhone: string | null }) {
  const valid = req.headers.get('x-bookeasy-sms-protocol') === '2' && /^\d+$/.test(req.headers.get('x-bookeasy-sim-id') || '') && matchesSmsSim(business.smsGatewayPhone, req.headers.get('x-bookeasy-sim-phone'))
  if (valid) return null
  const error = 'Trimitere blocată: actualizează aplicația BookEasy și selectează SIM-ul al cărui număr corespunde celui salvat în Setări. Nu folosim automat alt SIM.'
  await updateSmsDevice(business.id, { smsDeviceLastSeenAt: null, smsGatewayLastError: error })
  return privateJson({ error, configuredPhone: business.smsGatewayPhone }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const business = await authenticateSmsDevice(req.headers.get('authorization'))
  if (!business) return privateJson({ error: 'Telefon neautorizat. Folosește codul gateway-ului central din Superadmin → SMS.' }, { status: 401 })
  const blocked = await verifySim(req, business)
  if (blocked) return blocked

  if (!business.smsGatewayEnabled) return privateJson({ configuredPhone: business.smsGatewayPhone, job: null })
  await updateSmsDevice(business.id, { smsDeviceLastSeenAt: new Date(), smsGatewayLastError: null })
  const result = await claimNextSms(business)
  return privateJson({ configuredPhone: business.smsGatewayPhone, ...result }, { headers: { 'Cache-Control': 'no-store' } })
}

const reportSchema = z.object({ id: z.string().min(1), status: z.enum(['SENT', 'FAILED', 'UNKNOWN']), error: z.string().max(500).optional() })

export async function POST(req: NextRequest) {
  const business = await authenticateSmsDevice(req.headers.get('authorization'))
  if (!business) return privateJson({ error: 'Telefon neautorizat. Folosește codul gateway-ului central din Superadmin → SMS.' }, { status: 401 })
  const input = reportSchema.safeParse(await req.json().catch(() => null))
  if (!input.success) return privateJson({ error: 'Raport invalid.' }, { status: 400 })
  const { id, status, error } = input.data
  const scope = { senderKey: 'platform' }
  if (status === 'SENT') { const blocked = await verifySim(req, business); if (blocked) return blocked }
  const updated = await prisma.smsJob.updateMany({
    where: { id, ...scope, status: 'DISPATCHED' },
    data: { status, sentAt: status === 'SENT' ? new Date() : null, error: status !== 'SENT' ? error || 'Rezultatul trimiterii nu este confirmat.' : null },
  })
  if (updated.count === 0) {
    const existing = await prisma.smsJob.findFirst({ where: { id, ...scope }, select: { status: true } })
    if (existing?.status !== status) return privateJson({ error: 'SMS-ul nu este în curs de trimitere.' }, { status: 409 })
  }
  await updateSmsDevice(business.id, { smsDeviceLastSeenAt: status === 'SENT' ? new Date() : null, smsGatewayLastError: status !== 'SENT' ? error || 'Rezultatul SMS nu este confirmat.' : null })
  return privateJson({ success: true })
}
