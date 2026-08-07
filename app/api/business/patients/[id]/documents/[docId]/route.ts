import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { docId } = await params
  const doc = await prisma.patientDocument.findUnique({ where: { id: docId } })
  if (!doc || doc.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await del(doc.url, { token: process.env.BLOB_READ_WRITE_TOKEN, storeId: process.env.BOOKBLOB_STORE_ID }).catch(() => {})
  await prisma.patientDocument.delete({ where: { id: docId } })

  return NextResponse.json({ success: true })
}
