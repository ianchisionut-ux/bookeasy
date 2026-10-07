import { del, get, put } from '@vercel/blob'

// Keep legacy r2:// references already stored in the database. File contents
// now live in Vercel Blob, so no database rewrite is required.
const R2_SCHEME = 'r2://'
const PUBLIC_ROUTE = '/api/storage/public/'

type StoredBody = {
  body: ReadableStream
  httpEtag: string
  httpMetadata?: { contentType?: string }
  writeHttpMetadata(headers: Headers): void
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN nu este configurat în Vercel.')
  return token
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

export async function putR2File(key: string, file: File) {
  await put(key, file, {
    access: 'private',
    token: blobToken(),
    contentType: file.type || 'application/octet-stream',
    addRandomSuffix: false,
  })
  return key
}

export async function getR2File(key: string) {
  const result = await get(key, { access: 'private', token: blobToken() })
  if (!result?.stream || result.statusCode !== 200) return null
  return {
    body: result.stream,
    httpEtag: result.blob.etag,
    httpMetadata: { contentType: result.blob.contentType ?? undefined },
    writeHttpMetadata(headers: Headers) {
      if (result.blob.contentType) headers.set('Content-Type', result.blob.contentType)
    },
  } satisfies StoredBody
}

export async function deleteR2File(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  await del(key, { token: blobToken() })
  return true
}
