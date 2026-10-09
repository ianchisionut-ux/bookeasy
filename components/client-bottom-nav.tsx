'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, LayoutGrid, MapPin, Search } from 'lucide-react'

const excluded = ['/dashboard', '/superadmin', '/onboarding', '/login', '/signup', '/forgot-password', '/reset-password', '/inregistrare', '/api', '/demo', '/plata-confirmata', '/plata-anulata', '/cont-suspendat']

export default function ClientBottomNav() {
  const pathname = usePathname()
  if (excluded.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null

  const items = [
    { href: '/descopera', label: 'Acasă', icon: LayoutGrid, active: pathname === '/descopera' },
    { href: '/descopera#cauta', label: 'Caută', icon: Search, active: false },
    { href: '/descopera#favorite', label: 'Favorite', icon: Heart, active: false },
    { href: '/harta', label: 'Hartă', icon: MapPin, active: pathname === '/harta' },
  ]

  return (
    <>
      <div aria-hidden="true" className="screen-only h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav className="screen-only fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--border-soft)] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(17,38,58,.07)] md:hidden" aria-label="Navigare aplicație client">
        {items.map(({ href, label, icon: Icon, active }) => <Link key={label} href={href} onClick={() => window.dispatchEvent(new CustomEvent('bookeasy-client-nav', { detail: href }))} aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'font-semibold text-[var(--brand-teal-dark)]' : 'text-[var(--brand-ink)]'}`}><Icon size={21} />{label}</Link>)}
      </nav>
    </>
  )
}
