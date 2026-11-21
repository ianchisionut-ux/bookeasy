import type { Metadata } from 'next'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { LegalPage } from '@/components/ui/legal-page'
import { company } from '@/lib/company'
import dpa from '@/lib/dpa-public.json'

export const metadata: Metadata = {
  title: 'DPA – Acord de prelucrare a datelor | BookEasy',
  description: 'Modelul public BookEasy pentru acordul de prelucrare a datelor conform articolului 28 GDPR.',
}

export default function DpaPage() {
  return (
    <LegalPage title="DPA – Acord de prelucrare a datelor" updatedAt={dpa.updatedAt} version={dpa.version} description="Model public al acordului conform articolului 28 GDPR.">
      <div className="legal-callout">{dpa.notice}</div>
      <p>{company.legalName}, CUI {company.cui}, {company.tradeRegistryNumber}, cu sediul în {company.registeredAddress}.</p>
      <p><a className="btn-primary inline-flex items-center gap-2 no-underline" href="/legal/dpa-bookeasy.pdf" download><Download size={16} /> Descarcă DPA în format PDF</a></p>
      {dpa.sections.map(({ heading, paragraphs }) => (
        <section key={heading}>
          <h2>{heading}</h2>
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
      <p>Vezi și <Link href="/legal/confidentialitate">politica de confidențialitate</Link>.</p>
    </LegalPage>
  )
}
