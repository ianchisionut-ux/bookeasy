import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { signIn } from '@/lib/auth'
import { NATIVE_GOOGLE_COOKIE, nativeGoogleFlowExists } from '@/lib/native-google-auth'
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('flow')
  if (!await nativeGoogleFlowExists(id)) return new Response('Conectarea a expirat. Revino în BookEasy și încearcă din nou.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
  // Google starts and finishes in the SAME Safari context, including OAuth state and PKCE cookies.
  ;(await cookies()).set(NATIVE_GOOGLE_COOKIE, id!, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/native', maxAge: 300 })
  await signIn('google', { redirectTo: '/api/auth/native/complete' })
}
