import { privateJson } from '@/lib/private-json'
import { NextRequest } from 'next/server';
import { createNativeGoogleFlow } from '@/lib/native-google-auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return privateJson({ error: 'Origine invalidă.' }, { status: 403 })
  if (!(await rateLimit(`native-google-start:${getClientIp(req)}`, 30, 10 * 60 * 1000)).allowed) return privateJson({ error: 'Prea multe încercări. Revino în câteva minute.' }, { status: 429 })
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return privateJson({ error: 'Google nu este disponibil momentan.' }, { status: 503 })
  const body = await req.json().catch(() => null)
  const flow = await createNativeGoogleFlow(body?.challenge)
  return privateJson(flow ?? { error: 'Cerere invalidă.' }, { status: flow ? 201 : 400, headers: { 'Cache-Control': 'no-store' } })
}
