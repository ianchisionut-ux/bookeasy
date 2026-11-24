import { NextRequest, NextResponse } from 'next/server'
import { getR2File } from '@/lib/r2-storage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params
  const key = segments.join('/')
  if (!key.startsWith('public/')) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // A public URL can outlive its database record. A copy left in R2 must
  // never make a photo removed from Blob accessible again.
  const object = await getR2File(key, { includeLegacyR2: false })
  if (!object) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new NextResponse(object.body, { headers })
}
