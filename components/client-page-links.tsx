import Link from 'next/link'
import { ArrowLeft, Home, UserRound } from 'lucide-react'

export default function ClientPageLinks({ businessSlug, className = '' }: { businessSlug?: string; className?: string }) {
  return (
    <nav aria-label="Continuă navigarea" className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {businessSlug && <Link href={`/${businessSlug}`} className="btn-secondary inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft size={16} aria-hidden="true" />Pagina afacerii</Link>}
      <Link href="/descopera" className="btn-secondary inline-flex min-h-11 items-center gap-2 text-sm"><Home size={16} aria-hidden="true" />Acasă</Link>
      <Link href="/cont" className="btn-secondary inline-flex min-h-11 items-center gap-2 text-sm"><UserRound size={16} aria-hidden="true" />Contul meu</Link>
    </nav>
  )
}
