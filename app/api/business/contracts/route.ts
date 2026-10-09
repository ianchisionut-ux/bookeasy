import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildContractDocument, contractMissingFields, documentHash } from '@/lib/business-contracts'
import { signatureRequest, signingMetadata, validSignaturePng } from '@/lib/contract-signature'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const userId = (session as any)?.userId as string | undefined
  if (!session || !businessId || !userId || (session as any).role !== 'OWNER' || (session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'Doar titularul businessului poate semna.' }, { status: 403 })
  }
  if (!rateLimit(`contract-sign:${businessId}`, 10, 60 * 60 * 1000).allowed) return NextResponse.json({ error: 'Prea multe încercări de semnare.' }, { status: 429 })
  const parsed = signatureRequest.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !parsed.data.type || !parsed.data.documentHash || !validSignaturePng(parsed.data.signature)) {
    return NextResponse.json({ error: 'Semnătura sau datele sunt invalide.' }, { status: 400 })
  }
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Businessul nu există.' }, { status: 404 })
  const missing = contractMissingFields(business, parsed.data.type)
  if (missing.length) return NextResponse.json({ error: `Completează mai întâi: ${missing.join(', ')}.` }, { status: 409 })
  if (parsed.data.signerName !== business.contractRepresentativeName?.trim()) return NextResponse.json({ error: 'Numele semnatarului trebuie să corespundă reprezentantului salvat în datele juridice.' }, { status: 409 })
  const document = buildContractDocument(business, parsed.data.type)
  const hash = documentHash(document)
  if (hash !== parsed.data.documentHash) return NextResponse.json({ error: 'Datele contractului s-au schimbat. Reîncarcă pagina și citește noua versiune.' }, { status: 409 })
  const existing = await prisma.contractSignature.findUnique({ where: { businessId_type_documentHash: { businessId, type: parsed.data.type, documentHash: hash } } })
  if (existing) return NextResponse.json({ error: 'Această versiune a fost deja semnată.' }, { status: 409 })
  const metadata = signingMetadata(req)
  try {
    const signed = await prisma.contractSignature.create({ data: {
      businessId, type: parsed.data.type, version: document.version,
      document, documentHash: hash,
      customerSignature: parsed.data.signature,
      customerSignerName: parsed.data.signerName,
      customerUserId: userId,
      customerEmail: session.user?.email ?? null,
      customerIp: metadata.ip,
      customerUserAgent: metadata.userAgent,
    } })
    return NextResponse.json({ id: signed.id, success: true })
  } catch (error) {
    console.error('Semnarea contractului a eșuat:', error)
    return NextResponse.json({ error: 'Documentul nu a putut fi salvat.' }, { status: 500 })
  }
}
