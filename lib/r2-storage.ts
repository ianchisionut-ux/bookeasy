import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const R2_SCHEME = 'r2://'
const PUBLIC_ROUTE = '/api/storage/public/'

type StoredBody = {
  body: ReadableStream
  httpEtag: string
  httpMetadata?: { contentType?: string }
  writeHttpMetadata(headers: Headers): void
}

function s3Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error('Accesul R2 nu este configurat în Vercel.')
  return {
    bucketName: R2_BUCKET_NAME,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
  }
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
  const s3 = s3Config()
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucketName, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type || 'application/octet-stream' }))
  return key
}

export async function getR2File(key: string) {
  const s3 = s3Config()
  try {
    const object = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucketName, Key: key }))
    if (!object.Body) return null
    const body = object.Body.transformToWebStream()
    return {
      body,
      httpEtag: object.ETag ?? '',
      httpMetadata: { contentType: object.ContentType },
      writeHttpMetadata(headers: Headers) {
        if (object.ContentType) headers.set('Content-Type', object.ContentType)
        if (object.CacheControl) headers.set('Cache-Control', object.CacheControl)
      },
    } satisfies StoredBody
  } catch (error) {
    if ((error as { name?: string; $metadata?: { httpStatusCode?: number } }).name === 'NoSuchKey' || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null
    throw error
  }
}

export async function deleteR2File(value: string | null | undefined) {
  const key = r2Key(value)
  if (!key) return false
  const s3 = s3Config()
  await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucketName, Key: key }))
  return true
}
