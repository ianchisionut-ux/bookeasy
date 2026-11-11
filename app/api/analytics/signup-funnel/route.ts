import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { recordSignupFunnel } from '@/lib/signup-funnel'

const schema = z.object({
  step: z.enum(['view', 'start', 'submit']),
  promoCode: z.string().max(64).optional(),
  utmCampaign: z.string().max(64).optional(),
})

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return new NextResponse(null, { status: 403 })
  if (!(await rateLimit(`signup-funnel:${getClientIp(req)}`, 60, 15 * 60_000)).allowed) return new NextResponse(null, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return new NextResponse(null, { status: 400 })
  try {
    await recordSignupFunnel(parsed.data.step, parsed.data.promoCode, parsed.data.utmCampaign)
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[signup-funnel] Aggregate counter unavailable')
    return new NextResponse(null, { status: 503 })
  }
}
