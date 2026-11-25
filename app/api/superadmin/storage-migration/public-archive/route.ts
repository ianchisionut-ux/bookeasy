import { createHash } from 'node:crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { countStorageReferences } from '@/lib/storage-legacy-audit'

// One exact public-store object predates the private Blob store. Keep this
// preservation step separate: the private-store token cannot delete it.
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
const businessId = 'cmsiyc6ke0000l204tc0x10m3'
const sourceKey = 'cmsiyc6ke0000l204tc0x10m3/hero-1786124388977.jpg'
const sourceUrl = `https://sq36iolqxetddmgy.public.blob.vercel-storage.com/${sourceKey}`
const expectedEtag = '"316c1de9394d906b823d4422be140de3"'
const maxBytes = 5 * 1024 * 1024

type R2Object = { body: ReadableStream<Uint8Array>; size: number; httpMetadata?: { contentType?: string } }
type Bucket = {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  get(key: string): Promise<R2Object | null>
  put(key: string, value: Uint8Array, options: {
    onlyIf: Headers
    httpMetadata: { contentType: string; cacheControl: string; contentDisposition: string }
  }): Promise<unknown | null>
}

class ArchiveIssue extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code) }
}

function bucket(): Bucket {
  try {
    const destination = (getCloudflareContext().env as { BOOKEASY_FILES?: Bucket }).BOOKEASY_FILES
    if (destination) return destination
  } catch { /* Cloudflare runtime only. */ }
  throw new ArchiveIssue('destination_not_configured', 503)
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function readSource() {
  const response = await fetch(sourceUrl, { redirect: 'error', cache: 'no-store' })
  if (!response.ok || !response.body) throw new ArchiveIssue('source_unavailable', 503)
  if (response.headers.get('etag') !== expectedEtag ||
    response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase() !== 'image/jpeg') {
    await response.body.cancel()
    throw new ArchiveIssue('source_changed')
  }
  const statedLength = Number(response.headers.get('content-length') ?? 0)
  if (!Number.isFinite(statedLength) || statedLength > maxBytes) {
    await response.body.cancel()
    throw new ArchiveIssue('source_too_large')
  }
  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new ArchiveIssue('source_too_large')
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  if (!total || (statedLength && statedLength !== total)) throw new ArchiveIssue('source_size_changed')
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

async function destinationMatches(destination: Bucket, key: string, expectedBytes: Uint8Array) {
  const head = await destination.head(key)
  if (!head) return { present: false, verified: false }
  if (head.size !== expectedBytes.byteLength || head.httpMetadata?.contentType !== 'image/jpeg') {
    return { present: true, verified: false }
  }
  const object = await destination.get(key)
  if (!object || object.size !== expectedBytes.byteLength) return { present: true, verified: false }
  const actual = new Uint8Array(await new Response(object.body).arrayBuffer())
  return { present: true, verified: actual.byteLength === expectedBytes.byteLength &&
    sha256(actual) === sha256(expectedBytes) }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || !(session as { isSuperAdmin?: boolean }).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
  }
  if (process.env.STORAGE_MIGRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'migration_disabled' }, { status: 404, headers })
  }
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403, headers })
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (body?.mode !== 'dry-run' && body?.mode !== 'copy') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers })
  }
  try {
    const destination = bucket()
    const databaseReferences = await countStorageReferences(sourceUrl)
    const source = await readSource()
    // The legacy cover migration already stored this image under a
    // content-addressed public key and rewrote the business profile URL.
    // Check that exact R2 object first; do not create a duplicate original key.
    const digest = sha256(source)
    const targetKey = `public/${businessId}/migrated-cover-${digest}.jpg`
    let status = await destinationMatches(destination, targetKey, source)
    if (status.present && !status.verified) throw new ArchiveIssue('destination_changed')
    if (body.mode === 'copy' && !status.present) {
      await destination.put(targetKey, source, {
        onlyIf: new Headers({ 'If-None-Match': '*' }),
        httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable', contentDisposition: 'inline' },
      })
      status = await destinationMatches(destination, targetKey, source)
      if (!status.verified) throw new ArchiveIssue('destination_hash_mismatch', 503)
    }
    return NextResponse.json({ mode: body.mode, databaseReferences,
      sourceBytes: source.byteLength, sourceSha256: digest,
      r2Present: status.present, r2Verified: status.verified,
      copyNeeded: !status.present }, { headers })
  } catch (error) {
    const issue = error instanceof ArchiveIssue ? error : new ArchiveIssue('archive_check_failed', 503)
    return NextResponse.json({ error: issue.code }, { status: issue.status, headers })
  }
}
