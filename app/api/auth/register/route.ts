import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { randomBytes } from 'node:crypto'
import { LaunchSignupError, launchSignupData } from '@/lib/launch-campaign'
import { sendVerificationEmail } from '@/lib/email-verification'
import { recordSignupFunnel } from '@/lib/signup-funnel'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Parola trebuie să aibă minim 8 caractere').max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Parola este prea lungă.'),
  acceptLaunchTerms: z.boolean().optional(),
  launchOfferVersion: z.string().optional(),
  promoCode: z.string().trim().max(64).optional(),
  utmCampaign: z.string().trim().max(64).optional(),
  acceptSubscriptionTerms: z.boolean().optional(),
  planPriceVersion:z.string().max(500).optional(),
})

function provisionalSlug() { return 'afacere-' + randomBytes(6).toString('hex') }

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'Reîncarcă pagina și încearcă din nou.' }, { status: 403 })
  if (!(await rateLimit(`business-register:${getClientIp(req)}`, 5, 15 * 60_000)).allowed) return NextResponse.json({ error: 'Prea multe încercări. Revino în câteva minute.' }, { status: 429 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Date invalide.' }, { status: 400 })
  }
  const { email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email_accountKind: { email, accountKind: 'BUSINESS' } } })
  if (existing) {
    return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })
  }

  try {
  if (parsed.data.acceptSubscriptionTerms !== true) return NextResponse.json({ error: 'Acceptă termenii de utilizare și oferta afișată. Dacă pagina este mai veche, reîncarc-o.' }, { status: 400 })
  const campaignData = await launchSignupData(parsed.data.promoCode,prisma,parsed.data.launchOfferVersion??'',parsed.data.planPriceVersion??'')
  if (campaignData.launchEnrollment && parsed.data.acceptLaunchTerms !== true) return NextResponse.json({ error: 'Confirmă condițiile ofertei de lansare.' }, { status: 400 })
  if (!campaignData.launchEnrollment && parsed.data.acceptLaunchTerms) return NextResponse.json({ error: 'Oferta gratuită se aplică numai cu un cod promoțional valid. Reîncarcă pagina.' }, { status: 409 })
  const hashedPassword = await bcrypt.hash(password, 12)
  // Nested creation is atomic: no ownerless business after a duplicate email.
  const business = await prisma.business.create({
    data: {
      name: 'Afacerea mea',
      slug: provisionalSlug(),
      category: 'SALON',
      publicListed: false,
      onboardingStep: 1,
      onboardingDone: false,
      ...campaignData,
      users: { create: { email, password: hashedPassword, role: 'OWNER', emailVerificationRequired: true } },
    },
    include: { users: { select: { id: true } } },
  })

  // Measurement must never turn a successfully created account into an error.
  try { await recordSignupFunnel('created', parsed.data.promoCode, parsed.data.utmCampaign) }
  catch { console.error('[signup-funnel] Created counter unavailable') }

  let emailSent = true
  try { await sendVerificationEmail(business.users[0].id, email) } catch { emailSent = false; console.error('[business-register] Verification email failed; resend available') }
  return NextResponse.json({ success: true, requiresEmailVerification: true, emailSent })
  } catch (error) {
    if (error instanceof LaunchSignupError) return NextResponse.json({ error: error.message }, { status: error.status })
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })
    console.error('[business-register] Registration failed')
    return NextResponse.json({ error: 'Contul nu a putut fi creat. Încearcă din nou.' }, { status: 503 })
  }
}
