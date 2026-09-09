import { NextResponse } from 'next/server'
export function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get('role') === 'instructor'
  return NextResponse.json({
    id: owner ? '/fiteasy-instructor' : '/fiteasy-client',
    name: owner ? 'FitEasy Instructor' : 'FitEasy Client', short_name: 'FitEasy',
    start_url: owner ? '/dashboard/fitness' : '/fitness', scope: owner ? '/dashboard/' : '/fitness',
    display: 'standalone', background_color: '#f6f6f8', theme_color: '#063859', lang: 'ro',
    icons: [{ src: '/api/fitness/icon', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
