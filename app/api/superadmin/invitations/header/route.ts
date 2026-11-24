import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminAction } from '@/lib/admin-action'
import {
  INVITATION_HEADER_MAX_BYTES,
  INVITATION_HEADER_MAX_HEIGHT,
  INVITATION_HEADER_MAX_WIDTH,
  INVITATION_HEADER_MIN_HEIGHT,
  INVITATION_HEADER_MIN_WIDTH,
  invitationHeaderJpegDimensions,
} from '@/lib/invitation-header-image'
import { publicR2Url, putR2File } from '@/lib/r2-storage'

export const runtime = 'nodejs'
const MAX_REQUEST_BYTES = INVITATION_HEADER_MAX_BYTES + 2048
const invalidImage = () => NextResponse.json({ error: 'Alege o imagine JPG, PNG sau WebP de maximum 3 MB.' }, { status: 400 })

export async function POST(req: NextRequest) {
  const denied = await adminAction(req, true)
  if (denied) return denied

  const tooLarge = () => NextResponse.json({ error: 'Imaginea trebuie să aibă maximum 3 MB.' }, { status: 413 })
  if (Number(req.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) return tooLarge()
  if (!req.body) return invalidImage()

  const chunks: BlobPart[] = []
  const reader = req.body.getReader()
  let received = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      received += chunk.value.byteLength
      if (received > MAX_REQUEST_BYTES) return tooLarge()
      chunks.push(new Uint8Array(chunk.value))
    }
  } catch {
    return invalidImage()
  } finally {
    reader.releaseLock()
  }
  const form = await new Response(new Blob(chunks), {
    headers: { 'Content-Type': req.headers.get('content-type') ?? '' },
  }).formData().catch(() => null)

  const file = form?.get('image')
  if (!(file instanceof File) || file.type !== 'image/jpeg' || file.size > INVITATION_HEADER_MAX_BYTES || file.size === 0) {
    return invalidImage()
  }

  try {
    const dimensions = invitationHeaderJpegDimensions(new Uint8Array(await file.arrayBuffer()))
    if (!dimensions || dimensions.width > INVITATION_HEADER_MAX_WIDTH || dimensions.height > INVITATION_HEADER_MAX_HEIGHT) {
      return NextResponse.json({ error: 'Imaginea nu a putut fi procesată sau salvată.' }, { status: 400 })
    }
    if (dimensions.width < INVITATION_HEADER_MIN_WIDTH || dimensions.height < INVITATION_HEADER_MIN_HEIGHT) {
      return NextResponse.json({ error: 'Imaginea trebuie să aibă cel puțin 600 × 200 px.' }, { status: 400 })
    }

    const key = `public/invitation-headers/${randomUUID()}.jpg`
    await putR2File(key, file)
    return NextResponse.json({ url: publicR2Url(key) })
  } catch {
    return NextResponse.json({ error: 'Imaginea nu a putut fi procesată sau salvată.' }, { status: 400 })
  }
}
