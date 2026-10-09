import type { ContractDocument } from '@/lib/business-contracts'

type Signature = { image: string; name: string; at: string } | null

export function ContractDocumentView({ document, customerSignature, providerSignature }: {
  document: ContractDocument
  customerSignature?: Signature
  providerSignature?: Signature
}) {
  return <article className="contract-document mx-auto max-w-4xl bg-white p-6 text-sm leading-relaxed text-gray-900 sm:p-10 print:max-w-none print:p-0">
    <header className="contract-header mb-8 border-b border-gray-300 pb-5">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">BookEasy · versiunea {document.version}</p>
          <h1 className="mt-2 text-2xl font-bold">{document.title}</h1>
          <p className="mt-1 text-gray-600">{document.subtitle}</p>
        </div>
        <img src="/logo.png" alt="bookeasy.ro" className="contract-logo h-auto w-24 shrink-0 object-contain sm:w-28" />
      </div>
    </header>
    <div className="contract-parties mb-8 grid gap-5 sm:grid-cols-2">
      <div><h2 className="mb-2 font-bold">Furnizor / persoană împuternicită</h2>{document.provider.map((line, index) => <p key={index}>{line}</p>)}</div>
      <div><h2 className="mb-2 font-bold">Beneficiar / operator</h2>{document.customer.map((line, index) => <p key={index}>{line}</p>)}</div>
    </div>
    {document.sections.map((section) => <section key={section.heading} className="contract-section mb-5">
      <h2 className="mb-2 text-base font-bold">{section.heading}</h2>
      {section.paragraphs.map((paragraph, index) => <p key={index} className="mb-2 text-justify">{paragraph}</p>)}
    </section>)}
    <div className="contract-signatures mt-10 grid gap-8 border-t border-gray-300 pt-5 sm:grid-cols-2 break-inside-avoid-page">
      <div>
        <h2 className="font-bold">Semnătura beneficiarului</h2>
        {customerSignature ? <><img src={customerSignature.image} alt="Semnătura desenată de beneficiar" className="my-2 h-20 max-w-full object-contain object-left" /><p>{customerSignature.name}</p><p>{customerSignature.at}</p></> : <p className="mt-4 text-gray-500">În așteptarea semnării</p>}
      </div>
      <div>
        <h2 className="font-bold">Semnătura furnizorului</h2>
        {providerSignature ? <><img src={providerSignature.image} alt="Semnătura desenată de furnizor" className="my-2 h-20 max-w-full object-contain object-left" /><p>{providerSignature.name}</p><p>{providerSignature.at}</p></> : <p className="mt-4 text-gray-500">În așteptarea contrasemnării</p>}
      </div>
    </div>
    <p className="contract-signature-note mt-8 text-xs text-gray-500">Semnăturile desenate în aplicație sunt semnături electronice simple. Documentul și datele semnării sunt păstrate în cont; acest flux nu emite certificate calificate.</p>
  </article>
}
