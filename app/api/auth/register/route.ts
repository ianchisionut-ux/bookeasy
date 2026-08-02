import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Parola trebuie să aibă minim 8 caractere'),
})

function slugify(base: string) {
  return (
    base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7)
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })
  }

  // creăm un business "gol", completat efectiv la pasul 1 din onboarding
  const business = await prisma.business.create({
    data: {
      name: 'Afacerea mea',
      slug: slugify(email.split('@')[0]),
      category: 'SALON',
      publicListed: false,
      onboardingStep: 1,
      onboardingDone: false,
    },
  })

  const hashedPassword = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: { email, password: hashedPassword, role: 'OWNER', businessId: business.id },
  })

  return NextResponse.json({ success: true })
}
