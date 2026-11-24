import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/business-auth'
import { deleteR2FileAndVerify, getR2File, publicR2Url, r2Key, r2Url } from '@/lib/r2-storage'

async function getOwnedDocument(docId: string, customerId: string, businessId: string) {
  return prisma.patientDocument.findFirst({ where: { id: docId, customerId, businessId } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, docId } = await params
  const doc = await getOwnedDocument(docId, id, businessId)
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })

  try {
    let stream: ReadableStream | null = null
    let contentType = 'application/octet-stream'

    const key = r2Key(doc.url)
    if (key) {
      const object = await getR2File(key)
      if (!object) {
        return NextResponse.json({ error: 'Documentul nu a fost găsit în stocare.' }, { status: 404 })
      }
      stream = object.body
      contentType = object.httpMetadata?.contentType || contentType
    } else {
      // Compatibilitate de citire pentru fișierele publice vechi, până la migrare.
      const response = await fetch(doc.url, { cache: 'no-store' })
      if (!response.ok || !response.body) {
        return NextResponse.json({ error: 'Documentul nu a fost găsit în stocare.' }, { status: 404 })
      }
      stream = response.body
      contentType = response.headers.get('content-type') || contentType
    }

    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch (error) {
    console.error('Eroare la citirea documentului medical:', error)
    return NextResponse.json({ error: 'Documentul nu a putut fi descărcat.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, docId } = await params
  try {
    const result = await prisma.$transaction(async tx => {
      // Serialize concurrent deletes of this document. If storage succeeds but the
      // transaction later fails, the row remains and a retry can finish safely.
      const rows = await tx.$queryRaw<{ url: string }[]>`SELECT "url" FROM "PatientDocument" WHERE "id" = ${docId} AND "customerId" = ${id} AND "businessId" = ${businessId} FOR UPDATE`
      const doc = rows[0]
      if (!doc) return { status: 404, body: { error: 'not found' } }
      const key = r2Key(doc.url)
      if (!key) return { status: 409, body: { error: 'Acest document vechi nu poate fi șters din stocarea actuală. Contactează echipa BookEasy pentru migrare.' } }
      // Both reference formats name the same Blob. Do not remove it while another
      // medical record still points at either format.
      const aliases = [...new Set([doc.url, r2Url(key), publicR2Url(key)])]
      const otherReferences = await tx.patientDocument.count({ where: { url: { in: aliases }, id: { not: docId } } })
      if (otherReferences) return { status: 409, body: { error: 'Fișierul este folosit și de alt document. Contactează echipa BookEasy pentru corectare.' } }
      if (!(await deleteR2FileAndVerify(doc.url))) throw new Error('Documentul nu are o referință validă în stocare.')
      const deleted = await tx.patientDocument.deleteMany({ where: { id: docId, customerId: id, businessId } })
      if (deleted.count !== 1) throw new Error('Documentul nu a putut fi eliminat din baza de date.')
      return { status: 200, body: { success: true } }
    }, { timeout: 30000, maxWait: 10000 })
    return NextResponse.json(result.body, { status: result.status })
  } catch {
    // Provider exceptions may contain the private medical pathname.
    console.error('Eroare la ștergerea documentului medical.')
    return NextResponse.json({ error: 'Documentul nu a putut fi șters complet. Încearcă din nou; dacă eroarea persistă, contactează echipa BookEasy.' }, { status: 503 })
  }
}
