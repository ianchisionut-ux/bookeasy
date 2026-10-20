import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getR2File } from '@/lib/r2-storage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id, attachmentId } = await params
  const attachment = await prisma.platformEmailAttachment.findFirst({ where: { id: attachmentId, emailId: id } })
  if (!attachment?.storageKey) return NextResponse.json({ error: 'Atașamentul nu există.' }, { status: 404 })
  const file = await getR2File(attachment.storageKey)
  if (!file) return NextResponse.json({ error: 'Fișierul nu mai este disponibil.' }, { status: 410 })
  const headers = new Headers({
    'Content-Type': attachment.contentType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    'Cache-Control': 'private, no-store',
  })
  return new NextResponse(file.body, { headers })
}
