import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectMetaWhatsApp, MetaOnboardingError } from '@/lib/meta-whatsapp-onboarding'

const schema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele primite de la Meta sunt incomplete.' }, { status: 400 })

  try {
    const result = await connectMetaWhatsApp({ businessId, ...parsed.data })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof MetaOnboardingError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[business/meta-whatsapp]', error)
    return NextResponse.json({ error: 'Conectarea WhatsApp nu a putut fi finalizată.' }, { status: 500 })
  }
}
