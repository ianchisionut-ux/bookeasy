import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug-ul poate conține doar litere mici, cifre și cratime.'),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6, 'Parola trebuie să aibă minim 6 caractere.'),
  category: z.enum(['SALON', 'EVENT_VENUE']),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { slug, name, email, password, category } = parsed.data

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email } }),
  ])
  if (slugTaken) return NextResponse.json({ error: 'Slug-ul există deja.' }, { status: 409 })
  if (emailTaken) return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })

  const business = await prisma.business.create({
    data: { slug, name, category, publicListed: false, onboardingStep: 1, onboardingDone: false },
  })

  const hashedPassword = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: { email, password: hashedPassword, role: 'OWNER', businessId: business.id },
  })

  return NextResponse.json({ business })
}
