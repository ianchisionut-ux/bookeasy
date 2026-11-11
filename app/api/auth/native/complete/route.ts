import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { completeNativeGoogleFlow, NATIVE_GOOGLE_COOKIE } from '@/lib/native-google-auth'
export async function GET() {
  const jar = await cookies()
  const id = jar.get(NATIVE_GOOGLE_COOKIE)?.value
  const complete = await completeNativeGoogleFlow(id, await auth())
  jar.set(NATIVE_GOOGLE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/native', maxAge: 0 })
  const title = complete ? 'Te-ai conectat cu Google' : 'Conectarea a expirat'
  const detail = complete ? 'Revino în aplicația BookEasy. Contul tău se va deschide automat.' : 'Revino în aplicația BookEasy și încearcă din nou.'
  return new Response(`<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — BookEasy</title><style>body{font:17px system-ui;background:#f3f8f7;color:#263b3f;display:grid;place-items:center;min-height:90vh;margin:0}main{max-width:420px;padding:32px;text-align:center}h1{font-size:26px}p{line-height:1.6}</style><main><h1>${title}</h1><p>${detail}</p></main></html>`, { status: complete ? 200 : 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
