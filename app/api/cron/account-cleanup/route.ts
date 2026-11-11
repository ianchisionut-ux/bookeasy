import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { cleanupDeletedAccountFiles } from '@/lib/account-deletion'
export const maxDuration = 60
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await cleanupDeletedAccountFiles())
}
