import { createHash } from 'node:crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { del, get, list } from '@vercel/blob'

// Database references keep their existing shape while R2 becomes the primary
// store. The optional Blob token is only for reading and deleting old objects.
const R2_SCHEME = 'r2://'
const PUBLIC_ROUTE = '/api/storage/public/'

export type StoredBody = {
  body: ReadableStream
  httpEtag: string
  httpMetadata?: { contentType?: string }
  size?: number
  contentLength?: number
  contentRange?: string
  writeHttpMetadata(headers: Headers): void
}

type R2Object = {
  body: ReadableStream
  httpEtag: string
  size: number
  httpMetadata?: { contentType?: string }
  writeHttpMetadata(headers: Headers): void
}

type FilesBucket = {
  put(key: string, value: Blob | string, options?: { httpMetadata?: { contentType: string }; customMetadata?: Record<string, string>; onlyIf?: Headers }): Promise<unknown | null>
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<R2Object | null>
  head(key: string): Promise<{ size: number } | null>
  delete(key: string): Promise<void>
}

export class StorageRangeError extends Error {
  constructor(readonly size: number) { super('Intervalul de octeți nu este disponibil.') }
}

function filesBucket(): FilesBucket {
  const bucket = (getCloudflareContext().env as { BOOKEASY_FILES?: FilesBucket }).BOOKEASY_FILES
  if (!bucket) throw new Error('Bucketul Cloudflare R2 BOOKEASY_FILES nu este configurat.')
  return bucket
}

export function r2StorageConfigured() {
  try { return Boolean(filesBucket()) } catch { return false }
}

function legacyBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null
}

// A tombstone prevents a late copy or a failed legacy delete from making a
// removed photo/document readable again. Its key contains only a hash.
function tombstoneKey(key: string) {
  return `_deleted/${createHash('sha256').update(key).digest('hex')}`
}

export function r2Url(key: string) {
  return `${R2_SCHEME}${key}`
}

export function publicR2Url(key: string) {
  return `${PUBLIC_ROUTE}${key.split('/').map(encodeURIComponent).join('/')}`
}

export function r2Key(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith(R2_SCHEME)) return value.slice(R2_SCHEME.length)
  if (value.startsWith(PUBLIC_ROUTE)) {
    return value.slice(PUBLIC_ROUTE.length).split('/').map(decodeURIComponent).join('/')
  }
  return null
}

export async function putR2File(key: string, file: File, options?: { allowOverwrite?: boolean }) {
  const bucket = filesBucket()
  if (options?.allowOverwrite === false && await bucket.head(key)) throw new Error('Fișierul există deja în R2.')
  const token = legacyBlobToken()
  if (options?.allowOverwrite === false && token) {
    const legacy = await get(key, { access: 'private', token, useCache: false })
    if (legacy) {
      await legacy.stream?.cancel()
      throw new Error('Fișierul există deja în stocarea veche.')
    }
  }
  const result = await bucket.put(key, file, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    ...(options?.allowOverwrite === false ? { onlyIf: new Headers({ 'If-None-Match': '*' }) } : {}),
  })
  if (!result) throw new Error('Fișierul nu a putut fi salvat în R2.')
  await bucket.delete(tombstoneKey(key))
  return key
}

function byteRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || !size || (!match[1] && !match[2])) throw new StorageRangeError(size)
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) {
    throw new StorageRangeError(size)
  }
  return { start, end }
}

export async function getR2File(key: string, options?: { includeLegacyBlob?: boolean; range?: string }): Promise<StoredBody | null> {
  const bucket = filesBucket()
  if (await bucket.head(tombstoneKey(key))) return null

  const metadata = options?.range ? await bucket.head(key) : null
  const range = options?.range && metadata ? byteRange(options.range, metadata.size) : null
  const object = await bucket.get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined)
  if (object?.body) {
    return {
      body: object.body,
      httpEtag: object.httpEtag,
      httpMetadata: object.httpMetadata,
      size: object.size,
      contentLength: range ? range.end - range.start + 1 : object.size,
      contentRange: range ? `bytes ${range.start}-${range.end}/${object.size}` : undefined,
      writeHttpMetadata(headers) { object.writeHttpMetadata(headers) },
    }
  }

  const token = options?.includeLegacyBlob === false ? null : legacyBlobToken()
  if (!token) return null
  const result = await get(key, {
    access: 'private', token, useCache: false,
    ...(options?.range ? { headers: { Range: options.range } } : {}),
  })
  if (!result) return null
  if (!result.stream || result.statusCode !== 200) return null
  const contentRange = result.headers.get('content-range') ?? undefined
  const contentLength = Number(result.headers.get('content-length'))
  return {
    body: result.stream,
    httpEtag: result.blob.etag,
    httpMetadata: { contentType: result.blob.contentType ?? undefined },
    size: result.blob.size,
    contentLength: Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : undefined,
    contentRange,
    writeHttpMetadata(headers) {
      if (result.blob.contentType) headers.set('Content-Type', result.blob.contentType)
    },
  }
}

async function markDeleted(bucket: FilesBucket, key: string) {
  const written = await bucket.put(tombstoneKey(key), '', { customMetadata: { deleted: 'true' } })
  if (!written) throw new Error('Marcajul de ștergere R2 nu a putut fi salvat.')
}

export async function deleteR2File(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  const bucket = filesBucket()
  await markDeleted(bucket, key)
  await bucket.delete(key)
  const token = legacyBlobToken()
  if (token) await del(key, { token })
  return true
}

export async function deleteR2FileAndVerify(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  const bucket = filesBucket()
  await markDeleted(bucket, key)
  const token = legacyBlobToken()
  if (token) await deleteBlobAndVerify(key, token)
  await bucket.delete(key)
  if (await bucket.head(key)) throw new Error('Fișierul există încă în stocarea R2 după ștergere.')
  return true
}

// Keep a medical record until every exact-path legacy Blob version is gone.
async function deleteBlobAndVerify(key: string, token: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let cursor: string | undefined
    const matches: { url: string; etag: string }[] = []
    do {
      const page = await list({ prefix: key, cursor, token })
      matches.push(...page.blobs.filter(blob => blob.pathname === key).map(blob => ({ url: blob.url, etag: blob.etag })))
      if (page.hasMore && !page.cursor) throw new Error('Lista versiunilor fișierului este incompletă.')
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)

    if (matches.length) {
      for (const match of matches) await del(match.url, { token, ifMatch: match.etag })
      continue
    }

    const current = await get(key, { access: 'private', token, useCache: false })
    if (!current) return
    if (current.statusCode !== 200) throw new Error('Starea fișierului nu a putut fi verificată.')
    await current.stream.cancel()
    await del(key, { token, ifMatch: current.blob.etag })
  }
  throw new Error('Fișierul există încă în stocare după ștergere.')
}
