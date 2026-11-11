import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { syncLaunchBatch } from '@/lib/launch-campaign'

export const maxDuration = 300
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const started = Date.now(), now = new Date()
  let updated = 0, failed = 0, more = false
  do {
    const result = await syncLaunchBatch(now)
    updated += result.updated; failed += result.failed; more = result.batchFull
    if (result.failed) break
  } while (more && Date.now() - started < 240000)
  return NextResponse.json({ updated, failed, more }, { status: failed || more ? 503 : 200, headers: { 'Cache-Control': 'no-store' } })
}
