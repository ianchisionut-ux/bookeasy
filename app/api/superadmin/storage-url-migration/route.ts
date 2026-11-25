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

function newReference(kind: Kind, key: string, ownerId: string | null): string | null {
  if (!key || key.length > 1024 || key.includes('\\') || key.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  const publicUrl = () => `/api/storage/public/${key.split('/').map(encodeURIComponent).join('/')}`
  if (kind === 'business-public') return ownerId && key.startsWith(`public/businesses/${ownerId}/`) ? publicUrl() : null
  if (kind === 'invitation-header') return /^public\/invitation-headers\/[a-f0-9-]{36}\.jpg$/.test(key) ? publicUrl() : null
  if (kind === 'tutorial-poster') return key.startsWith('public/tutorials/') ? publicUrl() : null
  if (kind === 'invoice') return ownerId && key.startsWith(`invoices/${ownerId}/`) ? `r2://${key}` : null
  if (kind === 'patient') return ownerId && key.startsWith(`patients/${ownerId}/`) ? `r2://${key}` : null
  if (kind === 'deletion') return key.startsWith('public/businesses/') || key.startsWith('patients/') ? `r2://${key}` : null
  if (!/^tutorials\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+\.(mp4|vtt)$/.test(key)) return null
  if (kind === 'tutorial-video' && key.endsWith('.mp4')) return `/api/tutorials/media/${key}`
  if (kind === 'tutorial-captions' && key.endsWith('.vtt')) return `/api/tutorials/media/${key}`
  return null
}

async function bucket() {
  try {
    return (getCloudflareContext().env as {
      BOOKEASY_FILES?: { head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null> }
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

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: responseHeaders })
  if (process.env.STORAGE_MIGRATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'migration_disabled' }, { status: 404, headers: responseHeaders })
  }
  try {
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
  const limit = body?.limit ?? 5
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
  if (!token || !destination) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503, headers: responseHeaders })
  }

  const summary = { examined: 0, ready: 0, rewritten: 0, sourceUnavailable: 0, destinationMissing: 0, unsupported: 0, changedDuringMigration: 0 }
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

      let original: Awaited<ReturnType<typeof head>>
      try {
        original = await head(row.url, { token })
      } catch {
        unmatched(row.field, 'sourceUnavailable')
        continue
      }
      // The source API supplies the canonical pathname used by the object-copy
      // route. A URL that resolves to another object must never be rewritten.
      if (original.url !== row.url) { unmatched(row.field, 'unsupported'); continue }
      const replacement = newReference(source.kind, original.pathname, row.ownerId)
      if (!replacement || original.size <= 0) { unmatched(row.field, 'unsupported'); continue }

      const copied = await destination.head(original.pathname)
      if (!copied || copied.size !== original.size ||
        (copied.httpMetadata?.contentType && copied.httpMetadata.contentType !== original.contentType)) {
        unmatched(row.field, 'destinationMissing')
        continue
      }
      summary.ready++
      if (mode === 'check') continue

      // The row may have changed since the select. Compare-and-swap also makes
      // retries harmless after a successful batch or a concurrent edit.
      const table = Prisma.raw(`"${source.table}"`)
      const column = Prisma.raw(`"${source.column}"`)
      const changed = await prisma.$executeRaw(Prisma.sql`
        UPDATE ${table} SET ${column} = ${replacement}
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
