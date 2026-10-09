import { ContractSignButton } from '@/components/contract-sign-button'
import { company } from '@/lib/company'

type Signed = { id: string; type: 'SERVICES' | 'DPA'; hash: string; customerSignerName: string; customerSignedAt: string; providerSignedAt: string | null }

export function ContractAdminSection({ businessId, signatures, currentHashes }: { businessId: string; signatures: Signed[]; currentHashes: Record<'SERVICES' | 'DPA', string> }) {
  return <section className="card mt-6 p-5">
    <h2 className="text-lg font-semibold">Contracte BookEasy</h2>
    <p className="mt-1 text-sm text-gray-500">Titularul semnează din Setări. Deschide exemplarul și verifică datele înainte de contrasemnare.</p>
    {signatures.length === 0 ? <p className="mt-4 text-sm text-gray-500">Nu există contracte semnate de business.</p> : <div className="mt-4 space-y-3">
      {signatures.map((signed) => <div key={signed.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-sm">
        <div><p className="font-medium">{signed.type === 'DPA' ? 'Acord GDPR' : 'Contract de servicii'}</p><p className="text-gray-500">{signed.customerSignerName} · {new Date(signed.customerSignedAt).toLocaleString('ro-RO')}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/contracte/${signed.id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-teal-dark)] underline">Citește documentul</a>
          {signed.providerSignedAt ? <span className="text-green-700">Contrasemnat</span> : signed.hash !== currentHashes[signed.type] ? <span className="text-amber-700">Date schimbate · cere semnare nouă</span> : <ContractSignButton providerBusinessId={businessId} contractId={signed.id} initialName={company.representativeName} />}
        </div>
      </div>)}
    </div>}
  </section>
}
