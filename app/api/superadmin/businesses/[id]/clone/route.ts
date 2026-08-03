import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createPasswordToken, sendPasswordSetupEmail } from '@/lib/password-tokens'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  newSlug: z.string().regex(/^[a-z0-9-]+$/, 'Slug-ul poate conține doar litere mici, cifre și cratime.'),
  newName: z.string().min(2),
  newEmail: z.string().email(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: sourceBusinessId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { newSlug, newName, newEmail } = parsed.data

  const source = await prisma.business.findUnique({
    where: { id: sourceBusinessId },
    include: { services: true, resources: true, staff: true, workingHours: true },
  })
  if (!source) return NextResponse.json({ error: 'Business-ul sursă nu există.' }, { status: 404 })

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findUnique({ where: { slug: newSlug } }),
    prisma.user.findUnique({ where: { email: newEmail } }),
  ])
  if (slugTaken) return NextResponse.json({ error: 'Slug-ul există deja.' }, { status: 409 })
  if (emailTaken) return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })

  // notă: canalele (WhatsApp/Instagram/Facebook/Google) NU se clonează — fiecare business
  // are propriile conturi conectate, nu are sens să moștenească conexiunile sursei
  const newBusiness = await prisma.business.create({
    data: {
      slug: newSlug,
      name: newName,
      category: source.category,
      contactPhone: source.contactPhone,
      city: source.city,
      publicListed: false,
      onboardingDone: true,
      onboardingStep: 5,
    },
  })

  // parolă temporară, aleatorie, imposibil de folosit — clientul o setează singur prin
  // link-ul trimis pe email
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
  const newUser = await prisma.user.create({
    data: { email: newEmail, password: unusablePassword, role: 'OWNER', businessId: newBusiness.id },
  })

  const token = await createPasswordToken(newUser.id)
  await sendPasswordSetupEmail(newEmail, newName, token).catch((err) =>
    console.error('Eroare trimitere email configurare cont (clonare):', err)
  )

  await prisma.$transaction([
    prisma.workingHours.createMany({
      data: source.workingHours.map((wh) => ({
        businessId: newBusiness.id,
        weekday: wh.weekday,
        startTime: wh.startTime,
        endTime: wh.endTime,
      })),
    }),
    prisma.service.createMany({
      data: source.services.map((s) => ({
        businessId: newBusiness.id,
        name: s.name,
        type: s.type,
        durationMin: s.durationMin,
        price: s.price,
        active: s.active,
      })),
    }),
    prisma.resource.createMany({
      data: source.resources.map((r) => ({
        businessId: newBusiness.id,
        name: r.name,
        capacity: r.capacity,
        basePrice: r.basePrice,
      })),
    }),
    prisma.staff.createMany({
      data: source.staff.map((s) => ({ businessId: newBusiness.id, name: s.name, active: s.active })),
    }),
  ])

  return NextResponse.json({
    business: newBusiness,
    clonedServices: source.services.length,
    clonedResources: source.resources.length,
    clonedStaff: source.staff.length,
    clonedWorkingHours: source.workingHours.length,
  })
}
