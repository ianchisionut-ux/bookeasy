import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const maxDuration = 60

const MAX_VIDEO_BYTES = 250 * 1024 * 1024
const MAX_CAPTIONS_BYTES = 2 * 1024 * 1024
const PART_BYTES = 8 * 1024 * 1024
const VIDEO_KEY = /^tutorials\/[a-f0-9-]{36}\/video\.mp4$/
const CAPTIONS_KEY = /^tutorials\/[a-f0-9-]{36}\/captions\.vtt$/

type UploadedPart = { partNumber: number; etag: string }
type MultipartUpload = {
  uploadId: string
  uploadPart(partNumber: number, body: Blob): Promise<UploadedPart>
  complete(parts: UploadedPart[]): Promise<{ size: number }>
  abort(): Promise<void>
}
type TutorialBucket = {
  head(key: string): Promise<{ size: number } | null>
  put(key: string, body: Blob, options: { httpMetadata: { contentType: string }; onlyIf: Headers }): Promise<unknown | null>
  delete(key: string): Promise<void>
  createMultipartUpload(key: string, options: { httpMetadata: { contentType: string } }): Promise<MultipartUpload>
  resumeMultipartUpload(key: string, uploadId: string): MultipartUpload
}

function bucket(): TutorialBucket {
  const store = (getCloudflareContext().env as { BOOKEASY_FILES?: TutorialBucket }).BOOKEASY_FILES
  if (!store) throw new Error('Bucketul R2 nu este configurat.')
  return store
}

async function authorized(req: NextRequest) {
  return req.headers.get('origin') === req.nextUrl.origin && Boolean((await auth() as any)?.isSuperAdmin)
}

function uploadIdValid(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 400 })
  try {
    const store = bucket()
    if (body.action === 'create') {
      if (!VIDEO_KEY.test(body.key) || !Number.isSafeInteger(body.size) || body.size <= 0 || body.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: 'Videoclipul trebuie să fie MP4 de maximum 250 MB.' }, { status: 400 })
      }
      if (await store.head(body.key)) return NextResponse.json({ error: 'Fișierul există deja.' }, { status: 409 })
      const upload = await store.createMultipartUpload(body.key, { httpMetadata: { contentType: 'video/mp4' } })
      return NextResponse.json({ uploadId: upload.uploadId })
    }
    if (body.action === 'complete') {
      if (!VIDEO_KEY.test(body.key) || !uploadIdValid(body.uploadId) || !Array.isArray(body.parts) || !body.parts.length || body.parts.length > Math.ceil(MAX_VIDEO_BYTES / PART_BYTES)) {
        return NextResponse.json({ error: 'Date de încărcare invalide.' }, { status: 400 })
      }
      const parts: UploadedPart[] = body.parts
      if (!parts.every((part, i) => part?.partNumber === i + 1 && typeof part.etag === 'string' && part.etag.length > 0 && part.etag.length < 256)) {
        return NextResponse.json({ error: 'Fragmentele videoclipului sunt incomplete.' }, { status: 400 })
      }
      if (await store.head(body.key)) return NextResponse.json({ error: 'Fișierul există deja.' }, { status: 409 })
      const upload = store.resumeMultipartUpload(body.key, body.uploadId)
      const object = await upload.complete(parts)
      if (object.size <= 0 || object.size > MAX_VIDEO_BYTES) {
        await store.delete(body.key)
        return NextResponse.json({ error: 'Videoclipul depășește 250 MB.' }, { status: 413 })
      }
      return NextResponse.json({ pathname: body.key })
    }
    if (body.action === 'abort') {
      if (!VIDEO_KEY.test(body.key) || !uploadIdValid(body.uploadId)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 400 })
      await store.resumeMultipartUpload(body.key, body.uploadId).abort()
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Acțiune invalidă.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Încărcarea în R2 nu a reușit.' }, { status: 503 })
  }
}

export async function PUT(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const key = req.nextUrl.searchParams.get('key') || ''
  const uploadId = req.nextUrl.searchParams.get('uploadId')
  try {
    const store = bucket()
    if (CAPTIONS_KEY.test(key) && !uploadId) {
      if (Number(req.headers.get('content-length') || 0) > MAX_CAPTIONS_BYTES) return NextResponse.json({ error: 'Subtitrările depășesc 2 MB.' }, { status: 413 })
      const bytes = await req.arrayBuffer()
      if (!bytes.byteLength || bytes.byteLength > MAX_CAPTIONS_BYTES) return NextResponse.json({ error: 'Subtitrările sunt goale sau prea mari.' }, { status: 413 })
      const result = await store.put(key, new Blob([bytes], { type: 'text/vtt' }), {
        httpMetadata: { contentType: 'text/vtt' }, onlyIf: new Headers({ 'If-None-Match': '*' }),
      })
      if (!result) return NextResponse.json({ error: 'Fișierul există deja.' }, { status: 409 })
      return NextResponse.json({ pathname: key })
    }
    const partNumber = Number(req.nextUrl.searchParams.get('partNumber'))
    if (!VIDEO_KEY.test(key) || !uploadIdValid(uploadId) || !Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > Math.ceil(MAX_VIDEO_BYTES / PART_BYTES)) {
      return NextResponse.json({ error: 'Fragment invalid.' }, { status: 400 })
    }
    if (Number(req.headers.get('content-length') || 0) > PART_BYTES) return NextResponse.json({ error: 'Fragment prea mare.' }, { status: 413 })
    const bytes = await req.arrayBuffer()
    if (!bytes.byteLength || bytes.byteLength > PART_BYTES) return NextResponse.json({ error: 'Fragment gol sau prea mare.' }, { status: 413 })
    const part = await store.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, new Blob([bytes]))
    return NextResponse.json(part)
  } catch {
    return NextResponse.json({ error: 'Fragmentul nu a putut fi salvat în R2.' }, { status: 503 })
  }
}
