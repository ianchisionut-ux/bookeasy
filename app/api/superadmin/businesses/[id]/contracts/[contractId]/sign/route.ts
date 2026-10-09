import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { signatureRequest, signingMetadata, validSignaturePng } from '@/lib/contract-signature'
import { company } from '@/lib/company'
import { buildContractDocument, documentHash } from '@/lib/business-contracts'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; contractId: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 })
  const { id, contractId } = await params
  const parsed = signatureRequest.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !validSignaturePng(parsed.data.signature)) return NextResponse.json({ error: 'Semnătura este invalidă.' }, { status: 400 })
  if (parsed.data.signerName !== company.representativeName) return NextResponse.json({ error: 'Numele semnatarului trebuie să corespundă reprezentantului furnizorului indicat în contract.' }, { status: 409 })
  const contract = await prisma.contractSignature.findFirst({ where: { id: contractId, businessId: id }, select: { providerSignedAt: true, type: true, documentHash: true } })
  if (!contract) return NextResponse.json({ error: 'Documentul nu există.' }, { status: 404 })
  if (contract.providerSignedAt) return NextResponse.json({ error: 'Documentul este deja contrasemnat.' }, { status: 409 })
  const business = await prisma.business.findUnique({ where: { id } })
  if (!business || documentHash(buildContractDocument(business, contract.type)) !== contract.documentHash) return NextResponse.json({ error: 'Datele s-au schimbat. Businessul trebuie să semneze noua versiune.' }, { status: 409 })
  const metadata = signingMetadata(req)
  const result = await prisma.contractSignature.updateMany({ where: { id: contractId, businessId: id, providerSignedAt: null }, data: {
    providerSignature: parsed.data.signature,
    providerSignerName: parsed.data.signerName,
    providerUserId: String((session as any).userId),
    providerEmail: session.user?.email ?? null,
    providerSignedAt: new Date(),
    providerIp: metadata.ip,
    providerUserAgent: metadata.userAgent,
  } })
  if (!result.count) return NextResponse.json({ error: 'Documentul a fost deja contrasemnat.' }, { status: 409 })
  return NextResponse.json({ success: true })
}
