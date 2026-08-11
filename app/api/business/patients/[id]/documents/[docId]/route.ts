import { NextRequest, NextResponse } from 'next/server'
import { del, get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

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
    let stream: ReadableStream<Uint8Array> | null = null
    let contentType = 'application/octet-stream'

    if (doc.url.includes('.private.blob.vercel-storage.com')) {
      const storeIds = [...new Set([process.env.DOCMED_STORE_ID, process.env.BOOKBLOB_STORE_ID].filter(Boolean))] as string[]
      let result: Awaited<ReturnType<typeof get>> | null = null
      for (const storeId of storeIds) {
        try {
          const candidate = await get(doc.url, {
            access: 'private',
            token: process.env.BLOB_READ_WRITE_TOKEN,
            storeId,
          })
          if (candidate?.statusCode === 200 && candidate.stream) {
            result = candidate
            break
          }
        } catch {
          // Poate fi un document vechi din celălalt store privat; încercăm următorul.
        }
      }
      if (!result || result.statusCode !== 200 || !result.stream) {
        return NextResponse.json({ error: 'Documentul nu a fost găsit în stocare.' }, { status: 404 })
      }
      stream = result.stream
      contentType = result.blob.contentType || contentType
    } else {
      // Compatibilitate temporară pentru documentele vechi din store-ul public.
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

  const storeIds = doc.url.includes('.private.blob.vercel-storage.com')
    ? [...new Set([process.env.DOCMED_STORE_ID, process.env.BOOKBLOB_STORE_ID].filter(Boolean))]
    : [process.env.BOOKBLOB_STORE_ID]
  for (const storeId of storeIds) {
    try {
      await del(doc.url, { token: process.env.BLOB_READ_WRITE_TOKEN, storeId: storeId as string })
      break
    } catch {
      // Documentele vechi pot aparține celuilalt store; încercăm toate variantele cunoscute.
    }
  }
  await prisma.patientDocument.delete({ where: { id: docId } })

  return NextResponse.json({ success: true })
}
