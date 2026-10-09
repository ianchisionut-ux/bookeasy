import { notFound, redirect } from 'next/navigation'
import type { ContractDocument } from '@/lib/business-contracts'
import { documentHash } from '@/lib/business-contracts'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ContractDocumentView } from '@/components/contract-document-view'
import { PrintButton } from './print-button'

const date = (value: Date) => new Intl.DateTimeFormat('ro-RO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Bucharest' }).format(value)

export default async function SignedContractPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params
  const signed = await prisma.contractSignature.findUnique({ where: { id } })
  if (!signed || (!(session as any).isSuperAdmin && (session as any).businessId !== signed.businessId)) notFound()
  const document = signed.document as unknown as ContractDocument
  if (documentHash(document) !== signed.documentHash) throw new Error('Integritatea documentului nu poate fi verificată.')

  return <main className="min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0">
    <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 print:hidden">
      <a href={(session as any).isSuperAdmin ? `/superadmin/afaceri/${signed.businessId}` : '/dashboard/setari'} className="text-sm underline">Înapoi la setări</a>
      <PrintButton />
    </div>
    <ContractDocumentView document={document}
      customerSignature={{ image: signed.customerSignature, name: signed.customerSignerName, at: date(signed.customerSignedAt) }}
      providerSignature={signed.providerSignature && signed.providerSignerName && signed.providerSignedAt ? { image: signed.providerSignature, name: signed.providerSignerName, at: date(signed.providerSignedAt) } : null}
    />
    <div className="mx-auto max-w-4xl bg-white px-6 pb-8 text-xs text-gray-500 sm:px-10 print:px-0">
      <p>ID document: {signed.id}</p><p>Amprentă SHA-256 a conținutului: {signed.documentHash}</p>
      <p>Semnat din contul BookEasy {signed.customerEmail ?? signed.customerUserId} la {date(signed.customerSignedAt)}. {signed.providerSignedAt ? `Contrasemnat din contul ${signed.providerEmail ?? signed.providerUserId} la ${date(signed.providerSignedAt)}.` : 'În așteptarea contrasemnării furnizorului.'}</p>
    </div>
  </main>
}
