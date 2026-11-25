import { head } from '@vercel/blob'
import { Prisma } from '@prisma/client'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Temporary companion to /api/superadmin/storage-migration. Enable the
// rewrite only after its complete Blob -> R2 pass has been verified.
export const dynamic = 'force-dynamic'

const responseHeaders = { 'Cache-Control': 'private, no-store' }
const legacyPattern = '%blob.vercel-storage.com/%'
const maxBatchSize = 10

type Kind = 'business-public' | 'invitation-header' | 'invoice' | 'patient' | 'tutorial-video' | 'tutorial-captions' | 'tutorial-poster' | 'deletion'
type Source = { field: string; table: string; column: string; ownerSql: string; kind: Kind }
type UrlRow = { field: string; id: string; url: string; ownerId: string | null }
type Cursor = Pick<UrlRow, 'field' | 'id'>
type Target = { key: string; reference: string }
type MigrationBucket = {
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>
  put(key: string, value: Uint8Array, options: {
    onlyIf: Headers
    httpMetadata: { contentType: string; cacheControl: string; contentDisposition: string }
  }): Promise<{ size: number } | null>
}

// Only these plain URL columns can contain app-owned Blob references. JSON
// archives and third-party URLs are intentionally never rewritten.
const sources: readonly Source[] = [
  { field: 'Business.heroImageUrl', table: 'Business', column: 'heroImageUrl', ownerSql: 's."id"', kind: 'business-public' },
  { field: 'Business.billingInvoiceUrl', table: 'Business', column: 'billingInvoiceUrl', ownerSql: 's."id"', kind: 'invoice' },
  { field: 'BusinessPhoto.url', table: 'BusinessPhoto', column: 'url', ownerSql: 's."businessId"', kind: 'business-public' },
  { field: 'Practitioner.photoUrl', table: 'Practitioner', column: 'photoUrl', ownerSql: 's."businessId"', kind: 'business-public' },
  { field: 'PatientDocument.url', table: 'PatientDocument', column: 'url', ownerSql: 's."businessId"', kind: 'patient' },
  { field: 'LaunchBillingPeriod.invoiceUrl', table: 'LaunchBillingPeriod', column: 'invoiceUrl', ownerSql: '(SELECT e."businessId" FROM "LaunchEnrollment" AS e WHERE e."id" = s."enrollmentId")', kind: 'invoice' },
  { field: 'BillingModeChange.previousInvoiceUrl', table: 'BillingModeChange', column: 'previousInvoiceUrl', ownerSql: 's."businessId"', kind: 'invoice' },
  { field: 'BusinessInvitation.headerImageUrl', table: 'BusinessInvitation', column: 'headerImageUrl', ownerSql: 'NULL::text', kind: 'invitation-header' },
  { field: 'UsageTutorial.videoUrl', table: 'UsageTutorial', column: 'videoUrl', ownerSql: 'NULL::text', kind: 'tutorial-video' },
  { field: 'UsageTutorial.captionsUrl', table: 'UsageTutorial', column: 'captionsUrl', ownerSql: 'NULL::text', kind: 'tutorial-captions' },
  { field: 'UsageTutorial.posterUrl', table: 'UsageTutorial', column: 'posterUrl', ownerSql: 'NULL::text', kind: 'tutorial-poster' },
  { field: 'AccountFileDeletion.url', table: 'AccountFileDeletion', column: 'url', ownerSql: 'NULL::text', kind: 'deletion' },
] as const

const sourceByField = new Map(sources.map(source => [source.field, source]))
const maxPublicAliasBytes = 20 * 1024 * 1024

function sourceSql() {
  // Prisma.raw only receives the fixed identifiers above, never request data.
  return Prisma.join(sources.map(source => {
    const table = Prisma.raw(`"${source.table}"`)
    const column = Prisma.raw(`s."${source.column}"`)
    const owner = Prisma.raw(source.ownerSql)
    return Prisma.sql`SELECT ${source.field}::text AS "field", s."id"::text AS "id", ${column} AS "url", ${owner} AS "ownerId"
      FROM ${table} AS s WHERE ${column} ILIKE ${legacyPattern}`
  }), ' UNION ALL ')
}

function encodeCursor(row: Cursor) {
  return Buffer.from(JSON.stringify([row.field, row.id]), 'utf8').toString('base64url')
}

function decodeCursor(value: unknown): Cursor | null {
  if (value === undefined || value === null) return { field: '', id: '' }
  if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' ||
      typeof parsed[1] !== 'string' || !sourceByField.has(parsed[0]) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(parsed[1])) return null
    return { field: parsed[0], id: parsed[1] }
  } catch {
    return null
  }
}

function blobUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash ||
      !/^[a-z0-9-]+\.(?:public|private)\.blob\.vercel-storage\.com$/.test(url.hostname) ||
      url.pathname.length < 2) return null
    return url
  } catch {
    return null
  }
}

function blobPathname(url: URL) {
  try {
    const segments = url.pathname.slice(1).split('/')
    if (segments.some(segment => !segment || /%2f|%5c/i.test(segment))) return null
    const key = segments.map(decodeURIComponent).join('/')
    return key.length <= 1024 ? key : null
  } catch {
    return null
  }
}

function newReference(kind: Kind, key: string, ownerId: string | null): Target | null {
  if (!key || key.length > 1024 || key.includes('\\') || key.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  const publicTarget = (publicKey: string): Target => ({ key: publicKey,
    reference: `/api/storage/public/${publicKey.split('/').map(encodeURIComponent).join('/')}` })
  const privateTarget = (): Target => ({ key, reference: `r2://${key}` })
  if (kind === 'business-public') {
    if (!ownerId) return null
    if (key.startsWith(`public/businesses/${ownerId}/`) || key.startsWith(`public/${ownerId}/`)) return publicTarget(key)
    // Historical Blob uploads used `<businessId>/hero-...` without a public/
    // prefix. The exact object is first copied under its original key; this
    // route creates a verified, business-scoped public alias for the image.
    if (key.startsWith(`${ownerId}/`)) return publicTarget(`public/${key}`)
    return null
  }
  if (kind === 'invitation-header') {
    if (/^public\/invitation-headers\/[a-f0-9-]{36}\.jpg$/.test(key)) return publicTarget(key)
    if (/^invitation-headers\/[a-f0-9-]{36}\.jpg$/.test(key)) return publicTarget(`public/${key}`)
    return null
  }
  if (kind === 'tutorial-poster') {
    if (key.startsWith('public/tutorials/')) return publicTarget(key)
    if (key.startsWith('tutorials/')) return publicTarget(`public/${key}`)
    return null
  }
  if (kind === 'invoice') return ownerId && key.startsWith(`invoices/${ownerId}/`) ? privateTarget() : null
  if (kind === 'patient') return ownerId && key.startsWith(`patients/${ownerId}/`) ? privateTarget() : null
  if (kind === 'deletion') return key.startsWith('public/businesses/') || key.startsWith('patients/') ? privateTarget() : null
  if (!/^tutorials\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+\.(mp4|vtt)$/.test(key)) return null
  if (kind === 'tutorial-video' && key.endsWith('.mp4')) return { key, reference: `/api/tutorials/media/${key}` }
  if (kind === 'tutorial-captions' && key.endsWith('.vtt')) return { key, reference: `/api/tutorials/media/${key}` }
  return null
}

function isPublicKind(kind: Kind) {
  return kind === 'business-public' || kind === 'invitation-header' || kind === 'tutorial-poster'
}

function safePublicImageType(contentType: string) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(contentType.toLowerCase())
}

async function verifiedPublicAlias(bucket: MigrationBucket, sourceKey: string, targetKey: string,
  size: number, contentType: string, create: boolean) {
  if (size <= 0 || size > maxPublicAliasBytes || !safePublicImageType(contentType)) return false
  const source = await bucket.get(sourceKey)
  if (!source || source.size !== size) return false
  const sourceBytes = new Uint8Array(await new Response(source.body).arrayBuffer())
  if (sourceBytes.byteLength !== size) return false
  const sourceHash = new Uint8Array(await crypto.subtle.digest('SHA-256', sourceBytes))
  if (!(await bucket.head(targetKey))) {
    if (!create) return false
    await bucket.put(targetKey, sourceBytes, {
      onlyIf: new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable', contentDisposition: 'inline' },
    })
  }
  const target = await bucket.get(targetKey)
  if (!target || target.size !== size) return false
  const targetBytes = new Uint8Array(await new Response(target.body).arrayBuffer())
  if (targetBytes.byteLength !== size) return false
  const targetHash = new Uint8Array(await crypto.subtle.digest('SHA-256', targetBytes))
  return sourceHash.every((byte, index) => byte === targetHash[index])
}

async function readPublicBlob(url: string) {
  // Public-store objects may not be visible to the old private-store token.
  // Fetch only after the fixed-domain and owner-path checks have passed.
  const response = await fetch(url, { redirect: 'error', cache: 'no-store' })
  if (!response.ok || !response.body) return null
  const statedLength = Number(response.headers.get('content-length') || 0)
  if (statedLength > maxPublicAliasBytes) {
    await response.body.cancel()
    return null
  }
  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxPublicAliasBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (!size || (statedLength && statedLength !== size)) return null
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const contentType = response.headers.get('content-type')?.split(';')[0].trim() || 'application/octet-stream'
  return { bytes, contentType }
}

async function verifyPublicSourceInR2(bucket: MigrationBucket, target: Target,
  bytes: Uint8Array, contentType: string, create: boolean) {
  const current = await bucket.head(target.key)
  if (!current && !create) return false
  if (!current) {
    await bucket.put(target.key, bytes, {
      onlyIf: new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType, cacheControl: target.key.startsWith('public/')
        ? 'public, max-age=31536000, immutable' : 'private, no-store', contentDisposition: 'inline' },
    })
  }
  const object = await bucket.get(target.key)
  if (!object || object.size !== bytes.byteLength) return false
  const copiedBytes = new Uint8Array(await new Response(object.body).arrayBuffer())
  if (copiedBytes.byteLength !== bytes.byteLength) return false
  const [sourceHash, destinationHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', bytes), crypto.subtle.digest('SHA-256', copiedBytes),
  ])
  const left = new Uint8Array(sourceHash), right = new Uint8Array(destinationHash)
  return left.every((byte, index) => byte === right[index])
}

async function bucket(): Promise<MigrationBucket | undefined> {
  try {
    return (getCloudflareContext().env as {
      BOOKEASY_FILES?: MigrationBucket
    }).BOOKEASY_FILES
  } catch {
    return undefined
  }
}

async function authorized() {
  const session = await auth()
  return Boolean(session && (session as { isSuperAdmin?: boolean }).isSuperAdmin)
}

async function counts() {
  const rows = await prisma.$queryRaw<{ field: string; count: bigint }[]>(Prisma.sql`
    SELECT "field", COUNT(*) AS "count" FROM (${sourceSql()}) AS refs
    GROUP BY "field" ORDER BY "field"
  `)
  return {
    total: rows.reduce((sum, row) => sum + Number(row.count), 0),
    byField: Object.fromEntries(sources.map(source => [source.field, Number(rows.find(row => row.field === source.field)?.count ?? 0n)])),
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

async function allColumnsAudit(offset: number) {
  const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns AS c
    JOIN information_schema.tables AS t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
    ORDER BY c.table_name, c.column_name
  `
  const page = columns.slice(offset, offset + 40)
  if (!page.length) return { scannedColumns: 0, totalColumns: columns.length, nextOffset: null, matches: [] }
  const checks = page.map(column => {
    const table = Prisma.raw(quoteIdentifier(column.table_name))
    const field = Prisma.raw(quoteIdentifier(column.column_name))
    return Prisma.sql`SELECT ${column.table_name}::text AS "table", ${column.column_name}::text AS "column",
      COUNT(*) AS "count" FROM ${table} WHERE ${field}::text ILIKE ${legacyPattern}`
  })
  const matches = await prisma.$queryRaw<{ table: string; column: string; count: bigint }[]>(Prisma.sql`
    SELECT "table", "column", "count" FROM (${Prisma.join(checks, ' UNION ALL ')}) AS audit
    WHERE "count" > 0 ORDER BY "table", "column"
  `)
  return { scannedColumns: page.length, totalColumns: columns.length,
    nextOffset: offset + page.length < columns.length ? offset + page.length : null,
    matches: matches.map(match => ({ table: match.table, column: match.column, count: Number(match.count) })) }
}

export async function GET(request: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: responseHeaders })
  if (process.env.STORAGE_MIGRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'migration_disabled' }, { status: 404, headers: responseHeaders })
  }
  try {
    if (request.nextUrl.searchParams.get('scope') === 'all') {
      const offsetText = request.nextUrl.searchParams.get('offset') ?? '0'
      if (!/^(0|[1-9]\d{0,4})$/.test(offsetText)) {
        return NextResponse.json({ error: 'invalid_offset' }, { status: 400, headers: responseHeaders })
      }
      return NextResponse.json(await allColumnsAudit(Number(offsetText)), { headers: responseHeaders })
    }
    return NextResponse.json(await counts(), { headers: responseHeaders })
  } catch {
    return NextResponse.json({ error: 'audit_failed' }, { status: 503, headers: responseHeaders })
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: responseHeaders })
  if (process.env.STORAGE_MIGRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'migration_disabled' }, { status: 404, headers: responseHeaders })
  }
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403, headers: responseHeaders })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const mode = body?.mode
  const limit = body?.limit ?? 2
  const cursor = decodeCursor(body?.cursor)
  if ((mode !== 'check' && mode !== 'rewrite') || !Number.isInteger(limit) ||
    (limit as number) < 1 || (limit as number) > maxBatchSize || !cursor) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: responseHeaders })
  }
  // This separate flag is the operator's assertion that the full object copy
  // and hash-verification pass finished; each reference is checked again below.
  if (mode === 'rewrite' && process.env.STORAGE_URL_MIGRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'copy_not_confirmed' }, { status: 409, headers: responseHeaders })
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const destination = await bucket()
  if (!destination) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503, headers: responseHeaders })
  }

  const summary = { examined: 0, ready: 0, rewritten: 0, copyNeeded: 0, aliasNeeded: 0, sourceUnavailable: 0, destinationMissing: 0, unsupported: 0, changedDuringMigration: 0 }
  const unmatchedByField: Record<string, { sourceUnavailable: number; destinationMissing: number; unsupported: number }> = {}
  function unmatched(field: string, reason: 'sourceUnavailable' | 'destinationMissing' | 'unsupported') {
    summary[reason]++
    const counts = unmatchedByField[field] ??= { sourceUnavailable: 0, destinationMissing: 0, unsupported: 0 }
    counts[reason]++
  }
  try {
    const page = await prisma.$queryRaw<UrlRow[]>(Prisma.sql`
      SELECT "field", "id", "url", "ownerId" FROM (${sourceSql()}) AS refs
      WHERE ("field", "id") > (${cursor.field}, ${cursor.id})
      ORDER BY "field", "id" LIMIT ${(limit as number) + 1}
    `)
    const rows = page.slice(0, limit as number)
    for (const row of rows) {
      summary.examined++
      const source = sourceByField.get(row.field)
      const parsedUrl = blobUrl(row.url)
      if (!source || !parsedUrl) { unmatched(row.field, 'unsupported'); continue }
      let target: Target | null
      if (parsedUrl.hostname.endsWith('.public.blob.vercel-storage.com')) {
        // The legacy public Blob store is distinct from the private store.
        // Validate its owner-scoped key before fetching the exact HTTPS URL.
        const originalKey = blobPathname(parsedUrl)
        target = originalKey ? newReference(source.kind, originalKey, row.ownerId) : null
        if (!target) { unmatched(row.field, 'unsupported'); continue }
        let publicBlob: Awaited<ReturnType<typeof readPublicBlob>>
        try { publicBlob = await readPublicBlob(row.url) } catch { publicBlob = null }
        if (!publicBlob) { unmatched(row.field, 'sourceUnavailable'); continue }
        if (isPublicKind(source.kind) && !safePublicImageType(publicBlob.contentType)) {
          unmatched(row.field, 'unsupported'); continue
        }
        // Check is read-only. Rewrite may copy the public object directly to
        // the verified R2 destination, then compares the full SHA-256 digest.
        if (mode === 'check' && !(await destination.head(target.key))) {
          summary.copyNeeded++
          continue
        }
        if (!(await verifyPublicSourceInR2(destination, target, publicBlob.bytes,
          publicBlob.contentType, mode === 'rewrite'))) {
          unmatched(row.field, 'destinationMissing'); continue
        }
      } else {
        if (!token) { unmatched(row.field, 'sourceUnavailable'); continue }
        let original: Awaited<ReturnType<typeof head>>
        try { original = await head(row.url, { token }) } catch {
          unmatched(row.field, 'sourceUnavailable'); continue
        }
        // The source API supplies the canonical pathname used by the object-copy
        // route. A URL resolving to another object is never rewritten.
        if (original.url !== row.url) { unmatched(row.field, 'unsupported'); continue }
        target = newReference(source.kind, original.pathname, row.ownerId)
        if (!target || original.size <= 0 || (isPublicKind(source.kind) && !safePublicImageType(original.contentType))) {
          unmatched(row.field, 'unsupported'); continue
        }
        const copied = await destination.head(original.pathname)
        if (!copied || copied.size !== original.size ||
          (copied.httpMetadata?.contentType && copied.httpMetadata.contentType !== original.contentType)) {
          unmatched(row.field, 'destinationMissing'); continue
        }
        if (target.key !== original.pathname) {
          if (mode === 'check' && !(await destination.head(target.key))) {
            summary.aliasNeeded++
            continue
          }
          if (!(await verifiedPublicAlias(destination, original.pathname, target.key,
            original.size, original.contentType, mode === 'rewrite'))) {
            unmatched(row.field, 'destinationMissing'); continue
          }
        }
      }
      summary.ready++
      if (mode === 'check') continue

      // The row may have changed since the select. Compare-and-swap also makes
      // retries harmless after a successful batch or a concurrent edit.
      const table = Prisma.raw(`"${source.table}"`)
      const column = Prisma.raw(`"${source.column}"`)
      const changed = await prisma.$executeRaw(Prisma.sql`
        UPDATE ${table} SET ${column} = ${target.reference}
        WHERE "id" = ${row.id} AND ${column} = ${row.url}
      `)
      if (changed === 1) summary.rewritten++
      else summary.changedDuringMigration++
    }
    return NextResponse.json({ mode, ...summary, unmatchedByField, hasMore: page.length > (limit as number),
      nextCursor: page.length > (limit as number) && rows.length ? encodeCursor(rows[rows.length - 1]) : null },
      { headers: responseHeaders })
  } catch {
    return NextResponse.json({ error: 'batch_failed', ...summary, unmatchedByField, retryCursor: body?.cursor ?? null },
      { status: 503, headers: responseHeaders })
  }
}
