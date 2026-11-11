import { privateJson } from '@/lib/private-json'
import { NextRequest } from 'next/server';
import { nativeGoogleFlowStatus } from '@/lib/native-google-auth'
import { rateLimit } from '@/lib/rate-limit'
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return privateJson({ error: 'Origine invalidă.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (typeof body?.id !== 'string' || !/^[a-f0-9]{48}$/.test(body.id)) return privateJson({ ready: false, expired: true }, { status: 400 })
  if (!(await rateLimit(`native-google-poll:${body.id}`, 120, 5 * 60 * 1000)).allowed) return privateJson({ error: 'Așteaptă câteva secunde.' }, { status: 429 })
  return privateJson(await nativeGoogleFlowStatus(body.id, body.verifier), { headers: { 'Cache-Control': 'no-store' } })
}
