import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteR2File, r2Url } from '@/lib/r2-storage'
import { restoreReceivedEmailHtml } from '@/lib/platform-email'

async function authorized() {
  const session = await auth()
  return Boolean(session && (session as any).isSuperAdmin)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const include = { attachments: { select: {
    id: true, filename: true, contentType: true, contentId: true, size: true, storageKey: true,
  } } } as const
  let email = await prisma.platformEmail.findUnique({ where: { id }, include })
  if (!email) return NextResponse.json({ error: 'Mesajul nu există.' }, { status: 404 })
  if (email.direction === 'inbound' && !email.bodyHtml) {
    try {
      const bodyHtml = await restoreReceivedEmailHtml(id, email.providerEmailId)
      if (bodyHtml) email = await prisma.platformEmail.findUnique({ where: { id }, include })
    } catch (error) {
      console.error('[email] Recuperarea HTML a eșuat:', id, error instanceof Error ? error.message : 'unknown')
    }
  }
  if (!email) return NextResponse.json({ error: 'Mesajul nu există.' }, { status: 404 })
  if (!email.isRead) await prisma.platformEmail.update({ where: { id }, data: { isRead: true } })
  return NextResponse.json({ ...email, isRead: true, attachments: email.attachments.map(({ storageKey, ...item }) => ({
    ...item, available: Boolean(storageKey),
  })) })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const folder = body.folder
  if (folder !== undefined && !['inbox', 'sent', 'archive', 'trash'].includes(folder)) return NextResponse.json({ error: 'Folder invalid.' }, { status: 400 })
  if (body.isRead !== undefined && typeof body.isRead !== 'boolean') return NextResponse.json({ error: 'isRead invalid.' }, { status: 400 })
  const email = await prisma.platformEmail.update({ where: { id }, data: {
    ...(folder !== undefined ? { folder } : {}), ...(body.isRead !== undefined ? { isRead: body.isRead } : {}),
  } }).catch(() => null)
  if (!email) return NextResponse.json({ error: 'Mesajul nu există.' }, { status: 404 })
  return NextResponse.json({ email })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const email = await prisma.platformEmail.findUnique({ where: { id }, include: { attachments: true } })
  if (!email) return NextResponse.json({ error: 'Mesajul nu există.' }, { status: 404 })
  if (email.folder !== 'trash' || req.nextUrl.searchParams.get('permanent') !== '1') {
    await prisma.platformEmail.update({ where: { id }, data: { folder: 'trash' } })
    return NextResponse.json({ ok: true })
  }
  for (const attachment of email.attachments) {
    if (attachment.storageKey) await deleteR2File(r2Url(attachment.storageKey)).catch((error) =>
      console.error('[email] Blob cleanup failed:', error))
  }
  await prisma.platformEmail.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
