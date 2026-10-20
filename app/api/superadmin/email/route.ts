import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CONTACT_EMAIL } from '@/lib/platform-email'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const folder = req.nextUrl.searchParams.get('folder') || 'inbox'
  if (!['inbox', 'sent', 'archive', 'trash'].includes(folder)) return NextResponse.json({ error: 'Folder invalid.' }, { status: 400 })
  const query = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1) || 1)
  const where = {
    folder,
    ...(query ? { OR: [
      { fromAddress: { contains: query, mode: 'insensitive' as const } },
      { subject: { contains: query, mode: 'insensitive' as const } },
      { bodyText: { contains: query, mode: 'insensitive' as const } },
    ] } : {}),
  }
  const [rows, total, unread] = await Promise.all([
    prisma.platformEmail.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50,
      select: { id: true, direction: true, folder: true, fromAddress: true, toAddresses: true, subject: true, bodyText: true, isRead: true, receivedAt: true, sentAt: true, createdAt: true } }),
    prisma.platformEmail.count({ where }),
    prisma.platformEmail.count({ where: { folder: 'inbox', isRead: false } }),
  ])
  return NextResponse.json({ rows, total, unread, page, pages: Math.max(1, Math.ceil(total / 50)), address: CONTACT_EMAIL,
    configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET && process.env.BLOB_READ_WRITE_TOKEN) })
}
