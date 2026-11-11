import Link from 'next/link'
import Image from 'next/image'
import { company } from '@/lib/company'
import { PublicFooter } from '@/components/ui/public-footer'
import { publicMetadata } from '@/lib/seo'
import { ArrowLeft, Mail, Phone } from 'lucide-react'

export const metadata = publicMetadata(
  'Contact și suport | BookEasy',
  'Contactează echipa BookEasy pentru ajutor cu platforma, contul sau programările tale.',
  '/contact',
)

export default function ContactPage() {
  return <div className="flex min-h-screen flex-col bg-[#f5f8f7] text-[#193c3e]">
    <main className="flex-1 px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#147f83] hover:underline"><ArrowLeft size={16} aria-hidden="true" />Înapoi la BookEasy</Link>
        <div className="mt-8 rounded-[28px] border border-[#e1eae7] bg-white p-6 shadow-[0_12px_36px_#163b3310] sm:p-10">
          <Image src="/logo.png" alt="BookEasy" width={180} height={149} className="h-auto w-36" priority />
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[#168d8d]">Suntem aici să te ajutăm</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Contact și suport BookEasy</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#536a65]">Pentru întrebări despre cont, funcționarea platformei sau o programare făcută prin BookEasy, contactează echipa noastră. Dacă întrebarea privește un serviciu oferit de o afacere, poți contacta și afacerea direct din pagina ei publică.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <a href={`mailto:${company.legalEmail}`} className="rounded-2xl border border-[#dbeae5] bg-[#f4faf8] p-5 transition hover:border-[#168d8d]"><Mail size={22} className="text-[#168d8d]" aria-hidden="true" /><h2 className="mt-3 font-semibold">Scrie-ne un email</h2><p className="mt-1 break-all text-sm text-[#147f83]">{company.legalEmail}</p></a>
            <a href={`tel:${company.supportPhone}`} className="rounded-2xl border border-[#dbeae5] bg-[#f4faf8] p-5 transition hover:border-[#168d8d]"><Phone size={22} className="text-[#168d8d]" aria-hidden="true" /><h2 className="mt-3 font-semibold">Sună echipa BookEasy</h2><p className="mt-1 text-sm text-[#147f83]">{company.supportPhone}</p></a>
          </div>
          <p className="mt-8 border-t border-[#e8efec] pt-5 text-xs leading-6 text-[#718681]">Operatorul platformei: {company.legalName} · CUI {company.cui} · {company.registeredAddress}</p>
        </div>
      </div>
    </main>
    <PublicFooter />
  </div>
}
