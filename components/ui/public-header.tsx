import Link from 'next/link'
import Image from 'next/image'

export function PublicHeader() {
  return (
    <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-white/95 backdrop-blur gap-3">
      <Link href="/descopera" className="flex items-center gap-2 min-w-0">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={34} height={34} className="shrink-0" /><span className="font-semibold text-sm text-[var(--brand-ink)] sm:text-base truncate">bookeasy.ro</span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-4 text-sm shrink-0">
        <Link
          href="/descopera"
          className="text-gray-500 hover:text-[var(--brand-teal-dark)] transition whitespace-nowrap"
        >
          Descoperă
        </Link>
        <Link href="/dashboard" className="btn-secondary text-xs sm:text-sm py-1.5 px-3 sm:px-4 whitespace-nowrap">
          Intră în cont
        </Link>
      </nav>
    </header>
  )
}
