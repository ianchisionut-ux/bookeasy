import { createHash } from 'node:crypto'
import { get, list } from '@vercel/blob'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Temporary migration endpoint. Keep it disabled outside the migration window.
// It never deletes a source object or replaces a destination object.
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }
const maxBatchSize = 3

type R2File = {
  body: ReadableStream<Uint8Array>
  size: number
  httpMetadata?: { contentType?: string }
}

type MigrationBucket = {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  get(key: string): Promise<R2File | null>
  put(
    key: string,
    value: ReadableStream<Uint8Array> | Uint8Array,
    options: { onlyIf: Headers; httpMetadata: { contentType: string; cacheControl: string; contentDisposition: string } },
  ): Promise<{ size: number } | null>
}

type MigrationRequest = { mode: 'dry-run' | 'copy'; cursor?: string; limit: number }

class MigrationIssue extends Error {
  constructor(readonly code: string, readonly status = 502) {
    super(code)
  }
}

function parseRequest(value: unknown): MigrationRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (input.mode !== 'dry-run' && input.mode !== 'copy') return null
  const limit = input.limit ?? 2
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > maxBatchSize) return null
  if (input.cursor !== undefined && (typeof input.cursor !== 'string' || input.cursor.length > 4096)) return null
  return { mode: input.mode, limit: limit as number, cursor: input.cursor as string | undefined }
}

async function digestStream(stream: ReadableStream<Uint8Array>) {
  const hash = createHash('sha256')
  let size = 0
  const reader = stream.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      hash.update(value)
    }
  } finally {
    reader.releaseLock()
  }
  return { size, sha256: hash.digest('hex') }
}

async function copyStream(
  bucket: MigrationBucket,
  key: string,
  source: ReadableStream<Uint8Array>,
  size: number,
  httpMetadata: { contentType: string; cacheControl: string; contentDisposition: string },
) {
  const onlyIf = new Headers({ 'If-None-Match': '*' })
  const options = { onlyIf, httpMetadata }
  if (size === 0) {
    const digest = await digestStream(source)
    if (digest.size !== 0) throw new MigrationIssue('source_size_changed', 409)
    if (!(await bucket.put(key, new Uint8Array(0), options))) throw new MigrationIssue('destination_changed', 409)
    return digest
  }

  const FixedLengthStream = (globalThis as typeof globalThis & {
    FixedLengthStream?: new (length: number) => {
      readable: ReadableStream<Uint8Array>
      writable: WritableStream<Uint8Array>
    }
  }).FixedLengthStream
  if (!FixedLengthStream) throw new MigrationIssue('fixed_length_stream_unavailable', 503)

  const fixed = new FixedLengthStream(size)
  const write = bucket.put(key, fixed.readable, options)
  // The producer can still be reading when R2 rejects the upload.
  void write.catch(() => undefined)
  const reader = source.getReader()
  const writer = fixed.writable.getWriter()
  const hash = createHash('sha256')
  let copied = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      copied += value.byteLength
      if (copied > size) throw new MigrationIssue('source_size_changed', 409)
      hash.update(value)
      await writer.write(value)
    }
    if (copied !== size) throw new MigrationIssue('source_size_changed', 409)
    await writer.close()
    if (!(await write)) throw new MigrationIssue('destination_changed', 409)
    return { size: copied, sha256: hash.digest('hex') }
  } catch (error) {
    await writer.abort(error).catch(() => undefined)
    await reader.cancel().catch(() => undefined)
    await write.catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
    writer.releaseLock()
  }
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

  const input = parseRequest(await request.json().catch(() => null))
  if (!input) return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers })
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return NextResponse.json({ error: 'source_not_configured' }, { status: 503, headers })

  let bucket: MigrationBucket | undefined
  try {
    bucket = (getCloudflareContext().env as { BOOKEASY_FILES?: MigrationBucket }).BOOKEASY_FILES
  } catch {
    // This route is available only in the Cloudflare Worker runtime.
  }
  if (!bucket) return NextResponse.json({ error: 'destination_not_configured' }, { status: 503, headers })

  const totals = { examined: 0, deleted: 0, missing: 0, present: 0, copied: 0, verifiedExisting: 0, verifiedBytes: 0 }
  try {
    const page = await list({ mode: 'expanded', limit: input.limit, cursor: input.cursor, token })
    if (page.hasMore && !page.cursor) throw new MigrationIssue('source_cursor_missing')

    for (const item of page.blobs) {
      totals.examined++
      const deletedMarker = `_deleted/${createHash('sha256').update(item.pathname).digest('hex')}`
      if (await bucket.head(deletedMarker)) {
        totals.deleted++
        continue
      }
      const current = await bucket.head(item.pathname)
      if (current) totals.present++
      else totals.missing++
      if (input.mode === 'dry-run') continue

      const source = await get(item.pathname, { access: 'private', token, useCache: false })
      if (!source || source.statusCode !== 200) throw new MigrationIssue('source_unavailable', 409)
      if (source.blob.etag !== item.etag || source.blob.size !== item.size) {
        await source.stream.cancel()
        throw new MigrationIssue('source_changed_since_listing', 409)
      }

      let sourceDigest: { size: number; sha256: string }
      if (current) {
        sourceDigest = await digestStream(source.stream)
      } else {
        sourceDigest = await copyStream(bucket, item.pathname, source.stream, item.size, {
          contentType: source.blob.contentType,
          cacheControl: source.blob.cacheControl,
          contentDisposition: source.blob.contentDisposition,
        })
        totals.copied++
      }

      const destinationHead = await bucket.head(item.pathname)
      if (!destinationHead || destinationHead.size !== item.size) {
        throw new MigrationIssue('destination_size_mismatch', 409)
      }
      if (destinationHead.httpMetadata?.contentType !== source.blob.contentType) {
        throw new MigrationIssue('destination_content_type_mismatch', 409)
      }
      const destination = await bucket.get(item.pathname)
      if (!destination) throw new MigrationIssue('destination_unavailable', 409)
      const destinationDigest = await digestStream(destination.body)
      if (sourceDigest.size !== item.size || destinationDigest.size !== item.size ||
        sourceDigest.sha256 !== destinationDigest.sha256) {
        throw new MigrationIssue('destination_hash_mismatch', 409)
      }
      if (current) totals.verifiedExisting++
      totals.verifiedBytes += item.size
    }

    return NextResponse.json({ mode: input.mode, ...totals, hasMore: page.hasMore,
      nextCursor: page.hasMore ? page.cursor : null }, { headers })
  } catch (error) {
    const issue = error instanceof MigrationIssue ? error : new MigrationIssue('batch_failed')
    return NextResponse.json({ error: issue.code, retryCursor: input.cursor ?? null, ...totals },
      { status: issue.status, headers })
  }
}
