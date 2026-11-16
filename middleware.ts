import { NextRequest, NextResponse } from 'next/server'

// The public marketplace has been retired. Keep only sign-in, account recovery,
// the one-time owner invitation, and legal documents reachable without a session.
const openPages = new Set([
  '/', '/login', '/forgot-password', '/reset-password', '/verify-email',
  '/legal', '/legal/termeni', '/legal/confidentialitate', '/legal/cookies',
  '/termeni-si-conditii', '/politica-de-confidentialitate', '/dpa',
])
const privatePages = ['/dashboard', '/superadmin', '/onboarding', '/cont-suspendat']
const privateApis = ['/api/business', '/api/customers', '/api/superadmin', '/api/onboarding', '/api/oauth', '/api/google-calendar', '/api/billing', '/api/account', '/api/tutorials', '/api/subscription', '/api/storage']
const recoveryApis = new Set(['/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/resend-verification'])
const retiredAdminApis = ['/api/superadmin/promotions', '/api/superadmin/launch-campaign']
const retiredPages = ['/dashboard/planuri', '/superadmin/coduri-promotionale', '/superadmin/cereri']

function under(path: string, prefix: string) { return path === prefix || path.startsWith(`${prefix}/`) }

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, '') || '/'
  if (path.startsWith('/api/')) {
    if (retiredAdminApis.some(prefix => under(path, prefix))) return new NextResponse(null, { status: 404 })
    if (/^\/api\/(?:superadmin\/businesses\/[^/]+\/launch-campaign|cron\/launch-campaign|superadmin\/invitations\/header)(?:\/|$)/.test(path)) return new NextResponse(null, { status: 404 })
    // NextAuth routes are dynamic, but registration and native Google login are not.
    if (/^\/api\/auth\/(?:callback|session|signin|signout|csrf|providers|error)(?:\/|$)/.test(path)) return NextResponse.next()
    if (recoveryApis.has(path) || under(path, '/api/invitations')) return NextResponse.next()
    if (path === '/api/public/availability' || path === '/api/public/practitioners' || path === '/api/public/bookings' || /^\/api\/public\/bookings\/[^/]+\/arrival$/.test(path)) return NextResponse.next()
    if (under(path, '/api/webhooks') || under(path, '/api/cron') || under(path, '/api/sms-device')) return NextResponse.next()
    if (privateApis.some(prefix => under(path, prefix))) return NextResponse.next()
    return new NextResponse(null, { status: 404 })
  }
  if (path === '/robots.txt' || path === '/sitemap.xml' || /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?|ttf|mp4|webmanifest|js|css|glb|pdf|vtt|txt)$/.test(path)) return NextResponse.next()
  if (retiredPages.some(prefix => under(path, prefix))) return NextResponse.redirect(new URL(path.startsWith('/superadmin') ? '/superadmin/afaceri' : '/dashboard/setari', request.url))
  if (openPages.has(path) || under(path, '/invitatie-afacere')) return NextResponse.next()
  if (/^\/[^/]+\/rezerva$/.test(path)) return NextResponse.next()
  if (privatePages.some(prefix => under(path, prefix))) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/).*)'],
}
