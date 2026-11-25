import { createHash } from 'node:crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// Files are stored and served exclusively from Cloudflare R2.
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

// A tombstone keeps a deleted object unreadable if a concurrent upload or
// delayed operation races with deletion. Its key contains only a hash.
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

export async function getR2File(key: string, options?: { range?: string }): Promise<StoredBody | null> {
  const bucket = filesBucket()
  if (await bucket.head(tombstoneKey(key))) return null

  const metadata = options?.range ? await bucket.head(key) : null
  const range = options?.range && metadata ? byteRange(options.range, metadata.size) : null
  const object = await bucket.get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined)
  if (!object?.body) return null
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
  return true
}

export async function deleteR2FileAndVerify(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  const bucket = filesBucket()
  await markDeleted(bucket, key)
  await bucket.delete(key)
  if (await bucket.head(key)) throw new Error('Fișierul există încă în stocarea R2 după ștergere.')
  return true
}
