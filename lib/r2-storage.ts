import { getCloudflareContext } from '@opennextjs/cloudflare'

const R2_SCHEME = 'r2://'
const PUBLIC_ROUTE = '/api/storage/public/'

type StoredBody = {
  body: ReadableStream
  httpEtag: string
  httpMetadata?: { contentType?: string }
  writeHttpMetadata(headers: Headers): void
}

type FilesBucket = {
  put(key: string, value: ReadableStream, options: { httpMetadata: { contentType: string } }): Promise<unknown>
  get(key: string): Promise<StoredBody | null>
  delete(key: string): Promise<void>
}

async function bucket() {
  const { env } = await getCloudflareContext({ async: true })
  const store = (env as unknown as { BOOKEASY_FILES?: FilesBucket }).BOOKEASY_FILES
  if (!store) throw new Error('Bucketul Cloudflare R2 BOOKEASY_FILES nu este configurat.')
  return store
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
  const store = await bucket()
  await store.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })
  return key
}

export async function getR2File(key: string) {
  return (await bucket()).get(key)
}

export async function deleteR2File(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  await (await bucket()).delete(key)
  return true
}
