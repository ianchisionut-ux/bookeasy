import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/business-auth'
import { prisma } from '@/lib/prisma'
import { validPublicSlug } from '@/lib/public-slug'
import { setPublicSlug } from '@/lib/business-public-slug'
import { z } from 'zod'

export async function PATCH(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Origine invalidă.' }, { status: 403 })
  const session = await auth()
  if (!session || (session as any).role !== 'OWNER') return NextResponse.json({ error: 'Doar proprietarul poate schimba linkul public.' }, { status: 403 })
  const parsed = z.object({ slug: z.string().trim().toLowerCase().refine(validPublicSlug) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Folosește 3–64 de litere mici, cifre și cratime. Acest nume poate fi rezervat.' }, { status: 400 })
  const slug = await prisma.$transaction(tx => setPublicSlug(tx, (session as any).businessId, parsed.data.slug))
  if (!slug) return NextResponse.json({ error: 'Acest link este deja folosit. Alege alt nume.' }, { status: 409 })
  return NextResponse.json({ slug })
}
