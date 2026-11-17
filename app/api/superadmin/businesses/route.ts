import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createPasswordToken, sendPasswordSetupEmail, withEmailTimeout } from '@/lib/password-tokens'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { BUSINESS_CATEGORIES } from '@/lib/business-categories'
import { LaunchSignupError, launchSignupData } from '@/lib/launch-campaign'

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug-ul poate conține doar litere mici, cifre și cratime.'),
  name: z.string().min(2),
  email: z.string().email(),
  category: z.enum(BUSINESS_CATEGORIES),
  promoCode: z.string().trim().max(64).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { slug, name, email, category } = parsed.data

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findFirst({ where: { OR: [{ slug: slug }, { slugAliases: { some: { slug: slug } } }] } }),
    prisma.user.findUnique({ where: { email_accountKind: { email, accountKind: 'BUSINESS' } } }),
  ])
  if (slugTaken) return NextResponse.json({ error: 'Slug-ul există deja.' }, { status: 409 })
  if (emailTaken) return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })

  // parolă temporară, aleatorie, imposibil de folosit — clientul o setează singur prin
  // link-ul trimis pe email, ca prim pas de "verificare" a adresei lui reale
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
  let business
  try {
    const campaignData = await launchSignupData(parsed.data.promoCode)
    business = await prisma.business.create({ data: { slug, name, category, categoryLocked: true, publicListed: false, onboardingStep: 1, onboardingDone: false, ...campaignData, users: { create: { email, password: unusablePassword, role: 'OWNER' } } }, include: { users: { select: { id: true } } } })
  } catch (error) {
    if (error instanceof LaunchSignupError) return NextResponse.json({ error: error.message }, { status: error.status })
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'Slug-ul sau emailul există deja.' }, { status: 409 })
    throw error
  }
  const user = business.users[0]

  const token = await createPasswordToken(user.id)

  // trimitem cu timeout strict — businessul e deja creat, chiar dacă emailul întârzie
  // sau eșuează, poți retrimite linkul manual din panoul businessului
  await withEmailTimeout(sendPasswordSetupEmail(email, name, token))

  return NextResponse.json({ business })
}
