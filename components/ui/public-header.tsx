import Link from 'next/link'
import Image from 'next/image'

export function PublicHeader() {
  return (
    <header className="px-6 py-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-white">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={26} height={26} />
        <span className="font-semibold">bookeasy.ro</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/harta" className="text-gray-500 hover:text-gray-900 transition">
          Descoperă afaceri
        </Link>
        <Link href="/dashboard" className="btn-secondary text-sm py-1.5 px-4">
          Intră în cont
        </Link>
      </nav>
    </header>
  )
}
