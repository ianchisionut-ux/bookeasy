import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  if (!businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const kind = formData.get('kind') as string // 'hero' | 'gallery'

  if (!file) return NextResponse.json({ error: 'Fișierul lipsește.' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Doar imagini JPG, PNG sau WebP.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Imaginea depășește 5MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${businessId}/${kind}-${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: 'public' })

  if (kind === 'hero') {
    await prisma.business.update({ where: { id: businessId }, data: { heroImageUrl: blob.url } })
  } else {
    await prisma.businessPhoto.create({ data: { businessId, url: blob.url } })
  }

  return NextResponse.json({ url: blob.url })
}
