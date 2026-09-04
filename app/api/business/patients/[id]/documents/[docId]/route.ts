import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { deleteR2File, getR2File, r2Key } from '@/lib/r2-storage'

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, docId } = await params
  const doc = await getOwnedDocument(docId, id, businessId)
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await deleteR2File(doc.url).catch(() => {})
  await prisma.patientDocument.delete({ where: { id: docId } })

  return NextResponse.json({ success: true })
}
