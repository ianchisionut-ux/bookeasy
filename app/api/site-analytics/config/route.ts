import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const value = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN ?? ''
  const token = /^[a-f0-9]{32,64}$/i.test(value) ? value : null
  return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } })
}
