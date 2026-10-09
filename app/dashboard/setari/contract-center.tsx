import type { ContractDocument } from '@/lib/business-contracts'
import { ContractDocumentView } from '@/components/contract-document-view'
import { ContractSignButton } from '@/components/contract-sign-button'

type Entry = {
  type: 'SERVICES' | 'DPA'
  document: ContractDocument
  hash: string
  missing: string[]
  signed: { id: string; hash: string; customerSignedAt: string; providerSignedAt: string | null } | null
}

export function ContractCenter({ entries, canSign, representativeName }: { entries: Entry[]; canSign: boolean; representativeName: string }) {
  return <section className="mt-6 rounded-3xl border border-[var(--border-soft)] bg-white p-5 sm:p-6">
    <h2 className="text-xl font-bold">Contracte și semnături</h2>
    <p className="mt-1 text-sm text-gray-600">Documentele se completează din datele juridice de mai sus și din planul stabilit în Super Admin. Citește fiecare exemplar integral înainte de semnare.</p>
    <div className="mt-5 grid gap-5">
      {entries.map((entry) => {
        const current = entry.signed?.hash === entry.hash
        return <div key={entry.type} className="rounded-2xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">{entry.document.title}</h3><p className="mt-1 text-xs text-gray-500">Versiunea {entry.document.version}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs ${current ? entry.signed?.providerSignedAt ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
              {current ? entry.signed?.providerSignedAt ? 'Semnat de ambele părți' : 'Semnat de business · așteaptă furnizorul' : entry.signed ? 'Date schimbate · necesită semnare nouă' : 'Nesemnat'}
            </span>
          </div>
          <details className="mt-4 rounded-xl border border-gray-200"><summary className="cursor-pointer p-3 text-sm font-medium">Citește documentul completat</summary><div className="max-h-[65vh] overflow-y-auto border-t border-gray-200"><ContractDocumentView document={entry.document} /></div></details>
          {entry.missing.length > 0 && <p className="mt-3 text-sm text-amber-800">Înainte de semnare completează: {entry.missing.join(', ')}.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {entry.signed && <a className="text-sm font-medium text-[var(--brand-teal-dark)] underline" href={`/contracte/${entry.signed.id}`} target="_blank" rel="noopener noreferrer">Deschide exemplarul semnat · salvează PDF</a>}
            {!current && canSign && entry.missing.length === 0 && <ContractSignButton type={entry.type} documentHash={entry.hash} initialName={representativeName} />}
          </div>
        </div>
      })}
    </div>
    <p className="mt-5 text-xs text-gray-500">Semnătura desenată este electronică simplă; aplicația păstrează exemplarul, data, contul și amprenta SHA-256. Contractul este complet contrasemnat după semnătura furnizorului.</p>
  </section>
}
