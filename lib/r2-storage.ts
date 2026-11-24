import { del, get, list, put } from '@vercel/blob'

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

export async function putR2File(key: string, file: File, options?: { allowOverwrite?: boolean }) {
  await put(key, file, {
    access: 'private',
    token: blobToken(),
    contentType: file.type || 'application/octet-stream',
    addRandomSuffix: false,
    allowOverwrite: options?.allowOverwrite,
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

// Medical files keep their database record until every exact-path Blob entry is
// gone and an origin read confirms the pathname is absent.
export async function deleteR2FileAndVerify(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  const token = blobToken()

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
    if (!current) return true
    if (current.statusCode !== 200) throw new Error('Starea fișierului nu a putut fi verificată.')
    await current.stream.cancel()
    await del(key, { token, ifMatch: current.blob.etag })
  }

  throw new Error('Fișierul există încă în stocare după ștergere.')
}
