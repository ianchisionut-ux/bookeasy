'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export function ResponsiveShell({
  logoHref,
  logoLabel,
  children,
  content,
}: {
  logoHref: string
  logoLabel: string
  children: React.ReactNode // conținutul paginii
  content: React.ReactNode // conținutul sidebar-ului (nav, user block etc.)
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--surface-muted)] lg:grid lg:grid-cols-[220px_1fr]">
      {/* header mobil, doar sub lg */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[var(--border-soft)] sticky top-0 z-40">
        <Link href={logoHref} className="flex items-center gap-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={24} height={24} />
          <span className="font-semibold">{logoLabel}</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Deschide meniul"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* overlay + drawer, doar sub lg, doar cand e deschis */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full p-4 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <Link href={logoHref} className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={26} height={26} />
                <span className="font-semibold">{logoLabel}</span>
              </Link>
              <button onClick={() => setOpen(false)} aria-label="Închide meniul" className="w-8 h-8 flex items-center justify-center">
                ✕
              </button>
            </div>
            <div onClick={() => setOpen(false)}>{content}</div>
          </aside>
        </div>
      )}

      {/* sidebar fix, doar de la lg in sus */}
      <aside className="hidden lg:flex flex-col gap-1 p-4">
        <Link href={logoHref} className="flex items-center gap-2 mb-1 px-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
          <span className="font-semibold text-lg">{logoLabel}</span>
        </Link>
        {content}
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
