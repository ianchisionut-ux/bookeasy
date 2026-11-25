import { NextRequest, NextResponse } from 'next/server'
import { getR2File } from '@/lib/r2-storage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params
  const key = segments.join('/')
  if (!key.startsWith('public/')) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // R2 is primary. During the copy, old files are served from Blob only when
  // absent in R2; a deletion tombstone blocks either copy from reappearing.
  const object = await getR2File(key)
  if (!object) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new NextResponse(object.body, { headers })
}
