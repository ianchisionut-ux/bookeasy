import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { del, get, list } from '@vercel/blob'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { countStorageReferences } from '@/lib/storage-legacy-audit'

// Temporary, separately gated cleanup of the old PRIVATE Blob store. It is
// deliberately independent of the copy endpoint and disabled by default.
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
const maxBatchSize = 2
const maxObjects = 100
const proofLifetimeMs = 30 * 60 * 1000
const oldPrivateHost = 'xwrhrpurrcw8v50w.private.blob.vercel-storage.com'

type BlobItem = { pathname: string; url: string; etag: string; size: number }
type R2Object = { body: ReadableStream<Uint8Array>; size: number; httpMetadata?: { contentType?: string } }
type Bucket = {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  get(key: string): Promise<R2Object | null>
}
// Proofs carry only hashes and totals; private Blob URLs/pathnames never leave
// the server, even inside a decodable base64 token.
type ProofPayload = [string, string, number, string, number]

class PurgeIssue extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code) }
}

async function assertNoLegacyDatabaseReferences() {
  if (await countStorageReferences('blob.vercel-storage.com/')) {
    throw new PurgeIssue('database_references_present')
  }
}

function sourceToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) throw new PurgeIssue('source_not_configured', 503)
  const configuredHost = process.env.STORAGE_BLOB_PURGE_EXPECTED_HOST?.trim().toLowerCase()
  if (configuredHost !== oldPrivateHost || !token.startsWith('vercel_blob_rw_') ||
    token.split('_')[3]?.toLowerCase() !== oldPrivateHost.split('.')[0]) {
    throw new PurgeIssue('expected_store_not_configured', 503)
  }
  return token
}

function bucket(): Bucket {
  try {
    const destination = (getCloudflareContext().env as { BOOKEASY_FILES?: Bucket }).BOOKEASY_FILES
    if (destination) return destination
  } catch { /* Cloudflare runtime only. */ }
  throw new PurgeIssue('destination_not_configured', 503)
}

function assertPrivateItem(item: BlobItem) {
  try {
    const url = new URL(item.url)
    const configuredHost = process.env.STORAGE_BLOB_PURGE_EXPECTED_HOST?.trim().toLowerCase()
    if (configuredHost !== oldPrivateHost) {
      throw new PurgeIssue('expected_store_not_configured', 503)
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      url.hostname !== oldPrivateHost ||
      decodeURIComponent(url.pathname.slice(1)) !== item.pathname ||
      !item.pathname || item.pathname.length > 1024 || item.pathname.includes('\\') ||
      item.pathname.split('/').some(part => !part || part === '.' || part === '..') ||
      !Number.isSafeInteger(item.size) || item.size < 0 || !item.etag) {
      throw new Error('invalid')
    }
  } catch (error) {
    if (error instanceof PurgeIssue) throw error
    throw new PurgeIssue('source_inventory_invalid')
  }
}

async function digest(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const hash = createHash('sha256')
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      hash.update(value)
    }
  } finally { reader.releaseLock() }
  return { size, sha256: hash.digest('hex') }
}

async function verify(item: BlobItem, token: string, destination: Bucket) {
  assertPrivateItem(item)
  const tombstone = `_deleted/${hashText(item.pathname)}`
  if (await destination.head(tombstone)) throw new PurgeIssue('destination_marked_deleted')
  const source = await get(item.pathname, { access: 'private', token, useCache: false })
  if (!source || source.statusCode !== 200 || !source.stream) throw new PurgeIssue('source_unavailable')
  if (source.blob.url !== item.url) {
    await source.stream.cancel()
    throw new PurgeIssue('source_url_mismatch')
  }
  if (source.blob.etag !== item.etag) {
    await source.stream.cancel()
    throw new PurgeIssue('source_etag_mismatch')
  }
  if (source.blob.size !== item.size) {
    await source.stream.cancel()
    throw new PurgeIssue('source_size_mismatch')
  }
  const targetHead = await destination.head(item.pathname)
  if (!targetHead || targetHead.size !== item.size ||
    targetHead.httpMetadata?.contentType !== source.blob.contentType) {
    await source.stream.cancel()
    throw new PurgeIssue('destination_missing_or_changed')
  }
  const target = await destination.get(item.pathname)
  if (!target || target.size !== item.size) {
    await source.stream.cancel()
    throw new PurgeIssue('destination_missing_or_changed')
  }
  const [left, right] = await Promise.all([digest(source.stream), digest(target.body)])
  if (left.size !== item.size || right.size !== item.size || left.sha256 !== right.sha256) {
    throw new PurgeIssue('destination_hash_mismatch')
  }
  return left.sha256
}

async function verifyDestinationAfterPurge(item: BlobItem, expectedHash: string, destination: Bucket) {
  if (await destination.head(`_deleted/${hashText(item.pathname)}`)) {
    throw new PurgeIssue('destination_changed_after_purge', 503)
  }
  const head = await destination.head(item.pathname)
  const object = await destination.get(item.pathname)
  if (!head || head.size !== item.size || !object || object.size !== item.size) {
    throw new PurgeIssue('destination_changed_after_purge', 503)
  }
  const actual = await digest(object.body)
  if (actual.size !== item.size || actual.sha256 !== expectedHash) {
    throw new PurgeIssue('destination_changed_after_purge', 503)
  }
}

function issueProof(item: BlobItem, sha256: string, token: string) {
  const payload: ProofPayload = [itemId(item), hashText(item.etag), item.size, sha256, Date.now() + proofLifetimeMs]
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', token).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function readProof(value: unknown, token: string): ProofPayload {
  if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new PurgeIssue('invalid_proof')
  }
  const [encoded, signature] = value.split('.')
  const expected = Buffer.from(createHmac('sha256', token).update(encoded).digest('base64url'))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new PurgeIssue('invalid_proof')
  let payload: unknown
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) } catch { throw new PurgeIssue('invalid_proof') }
  if (!Array.isArray(payload) || payload.length !== 5 ||
    typeof payload[0] !== 'string' || !/^[a-f0-9]{64}$/.test(payload[0]) ||
    typeof payload[1] !== 'string' || !/^[a-f0-9]{64}$/.test(payload[1]) ||
    !Number.isSafeInteger(payload[2]) || payload[2] < 0 ||
    typeof payload[3] !== 'string' || !/^[a-f0-9]{64}$/.test(payload[3]) ||
    !Number.isSafeInteger(payload[4]) ||
    payload[4] < Date.now() || payload[4] > Date.now() + proofLifetimeMs) throw new PurgeIssue('invalid_or_expired_proof')
  return payload as ProofPayload
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function itemId(item: BlobItem) {
  return hashText(`${item.pathname}\0${item.url}`)
}

async function listAll(token: string) {
  const items: BlobItem[] = []
  let cursor: string | undefined
  do {
    const page = await list({ mode: 'expanded', limit: 100, cursor, token })
    items.push(...page.blobs)
    if (items.length > maxObjects) throw new PurgeIssue('inventory_exceeds_limit')
    if (page.hasMore && !page.cursor) throw new PurgeIssue('source_cursor_missing', 503)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  for (const item of items) assertPrivateItem(item)
  return items
}

function requireExactInventory(items: BlobItem[], proofs: string[], token: string) {
  if (items.length !== proofs.length) throw new PurgeIssue('inventory_changed')
  const verified = new Map<string, { proof: string; payload: ProofPayload }>()
  for (const proof of proofs) {
    const payload = readProof(proof, token)
    if (verified.has(payload[0])) throw new PurgeIssue('duplicate_proof')
    verified.set(payload[0], { proof, payload })
  }
  for (const item of items) {
    const proof = verified.get(itemId(item))?.payload
    if (!proof || proof[1] !== hashText(item.etag) || proof[2] !== item.size) {
      throw new PurgeIssue('inventory_changed')
    }
  }
  return verified
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
  if (body?.mode !== 'dry-run' && body?.mode !== 'purge') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers })
  }

  try {
    const token = sourceToken()
    const destination = bucket()
    await assertNoLegacyDatabaseReferences()

    if (body.mode === 'dry-run') {
      const limit = body.limit ?? maxBatchSize
      if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > maxBatchSize ||
        (body.cursor !== undefined && (typeof body.cursor !== 'string' || body.cursor.length > 4096))) {
        throw new PurgeIssue('invalid_request', 400)
      }
      const page = await list({ mode: 'expanded', limit: limit as number,
        cursor: body.cursor as string | undefined, token })
      if (page.hasMore && !page.cursor) throw new PurgeIssue('source_cursor_missing', 503)
      const proofs: string[] = []
      let verifiedBytes = 0
      for (const item of page.blobs) {
        const sha256 = await verify(item, token, destination)
        proofs.push(issueProof(item, sha256, token))
        verifiedBytes += item.size
      }
      return NextResponse.json({ mode: 'dry-run', verified: proofs.length, verifiedBytes, proofs,
        hasMore: page.hasMore, nextCursor: page.hasMore ? page.cursor : null }, { headers })
    }

    if (process.env.STORAGE_BLOB_PURGE_ENABLED !== 'true') throw new PurgeIssue('purge_disabled', 403)
    const proofs = body.proofs
    if (!Array.isArray(proofs) || proofs.length > maxObjects || proofs.some(value => typeof value !== 'string')) {
      throw new PurgeIssue('invalid_request', 400)
    }
    const before = await listAll(token)
    const verified = requireExactInventory(before, proofs, token)
    if (!before.length) return NextResponse.json({ mode: 'purge', purged: 0, remaining: 0 }, { headers })
    const item = before[0]
    const attestation = verified.get(itemId(item))
    if (!attestation) throw new PurgeIssue('inventory_changed')
    const currentHash = await verify(item, token, destination)
    if (attestation.payload[3] !== currentHash) throw new PurgeIssue('source_or_destination_changed')

    await del(item.url, { token, ifMatch: item.etag })
    await verifyDestinationAfterPurge(item, currentHash, destination)

    // Start enumeration over: cursors from a shrinking list can skip items.
    const after = await listAll(token)
    if (after.length !== before.length - 1 || after.some(current => current.pathname === item.pathname)) {
      throw new PurgeIssue('source_still_listed', 503)
    }
    requireExactInventory(after, proofs.filter(proof => proof !== attestation.proof), token)
    return NextResponse.json({ mode: 'purge', purged: 1, remaining: after.length,
      processedProof: attestation.proof }, { headers })
  } catch (error) {
    const issue = error instanceof PurgeIssue ? error : new PurgeIssue('purge_batch_failed', 503)
    return NextResponse.json({ error: issue.code }, { status: issue.status, headers })
  }
}
