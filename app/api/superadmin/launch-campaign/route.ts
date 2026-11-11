import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LAUNCH_CAMPAIGN_ID } from '@/lib/launch-policy'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  const parsed = z.object({ enrollmentOpen: z.boolean() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await prisma.launchCampaign.update({ where: { id: LAUNCH_CAMPAIGN_ID }, data: parsed.data })
  return NextResponse.json({ ok: true })
}
