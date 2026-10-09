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
  if (documentHash(document) !== signed.documentHash) {
    console.error('[contract-integrity] Hash invalid pentru documentul', signed.id)
    return <main className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-red-700">Documentul nu poate fi afișat în siguranță</h1>
        <p className="mt-2 text-sm text-gray-600">Integritatea exemplarului salvat nu a putut fi confirmată. Din motive de siguranță, documentul nu este afișat până la verificarea administratorului.</p>
        <a href={(session as any).isSuperAdmin ? `/superadmin/afaceri/${signed.businessId}` : '/dashboard/setari'} className="mt-4 inline-flex text-sm underline">Înapoi la setări</a>
      </div>
    </main>
  }

  return <main className="contract-print-page min-h-screen bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0">
    <style media="print">{'@page { size: A4 portrait; margin: 14mm 15mm 16mm; }'}</style>
    <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 print:hidden">
      <a href={(session as any).isSuperAdmin ? `/superadmin/afaceri/${signed.businessId}` : '/dashboard/setari'} className="text-sm underline">Înapoi la setări</a>
      <PrintButton />
    </div>
    <ContractDocumentView document={document}
      customerSignature={{ image: signed.customerSignature, name: signed.customerSignerName, at: date(signed.customerSignedAt) }}
      providerSignature={signed.providerSignature && signed.providerSignerName && signed.providerSignedAt ? { image: signed.providerSignature, name: signed.providerSignerName, at: date(signed.providerSignedAt) } : null}
    />
    <div className="contract-audit mx-auto max-w-4xl bg-white px-6 pb-8 text-xs text-gray-500 sm:px-10 print:px-0">
      <p>ID document: {signed.id}</p><p>Amprentă SHA-256 a conținutului: {signed.documentHash}</p>
      <p>Semnat din contul BookEasy {signed.customerEmail ?? signed.customerUserId} la {date(signed.customerSignedAt)}. {signed.providerSignedAt ? `Contrasemnat din contul ${signed.providerEmail ?? signed.providerUserId} la ${date(signed.providerSignedAt)}.` : 'În așteptarea contrasemnării furnizorului.'}</p>
    </div>
  </main>
}
