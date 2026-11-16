import { NextRequest, NextResponse } from 'next/server'
import { getR2File } from '@/lib/r2-storage'
import { auth } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const session = await auth()
  if (!session || !['OWNER', 'STAFF', 'SUPER_ADMIN'].includes(String((session as any).role))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { key: segments } = await params
  const key = segments.join('/')
  if (!key.startsWith('public/')) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const isSuperAdmin = (session as any).role === 'SUPER_ADMIN'
  const ownBusinessFile = segments[0] === 'public' && segments[1] === 'businesses' && segments[2] === (session as any).businessId
  if (!isSuperAdmin && !ownBusinessFile) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const object = await getR2File(key)
  if (!object) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new NextResponse(object.body, { headers })
}
