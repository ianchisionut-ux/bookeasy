'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export function ResponsiveShell({
  logoHref,
  logoLabel,
  navItems,
  accentColor,
  accountContent,
  children,
}: {
  logoHref: string
  logoLabel: string
  navItems: { href: string; label: string; badge?: number }[]
  accentColor?: string // culoarea aleasă de business în Setări — dacă lipsește, folosim culoarea implicită bookeasy
  accountContent: React.ReactNode // blocul de cont/ieșire — separat, ca să nu intre în carusel
  children: React.ReactNode
}) {
  const [accountOpen, setAccountOpen] = useState(false)
  const pathname = usePathname()
  const accent = accentColor || 'var(--accent)'
  const softTint = accentColor ? `${accentColor}0d` : 'var(--surface-muted)' // ~5% opacitate, discret

  return (
    <div className="min-h-screen bg-[var(--surface-muted)] lg:grid lg:grid-cols-[220px_1fr]">
      {/* header mobil, doar sub lg */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-[var(--border-soft)]" style={{ background: accentColor ? softTint : 'white' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={logoHref} className="flex items-center gap-2">
            <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={24} height={24} />
            <span className="font-semibold">{logoLabel}</span>
          </Link>
          <button
            onClick={() => setAccountOpen(true)}
            aria-label="Cont"
            className="w-9 h-9 flex items-center justify-center rounded-full text-sm"
            style={{ background: accentColor ? `${accentColor}22` : 'var(--accent-soft)' }}
          >
            👤
          </button>
        </div>

        {/* carusel orizontal de navigare — scroll cu degetul, fără dropdown */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition flex items-center gap-1.5"
                style={
                  active
                    ? { background: accent, color: 'white' }
                    : { background: 'var(--surface-muted)', color: 'var(--foreground)' }
                }
              >
                {item.label}
                {!!item.badge && (
                  <span className="text-xs bg-red-600 text-white rounded-full px-1.5 min-w-[16px] text-center leading-4">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* popover de cont, doar sub lg, doar cand e deschis */}
      {accountOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAccountOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full p-4 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Cont</span>
              <button onClick={() => setAccountOpen(false)} aria-label="Închide" className="w-8 h-8 flex items-center justify-center">
                ✕
              </button>
            </div>
            <div onClick={() => setAccountOpen(false)}>{accountContent}</div>
          </aside>
        </div>
      )}

      {/* sidebar fix, doar de la lg in sus */}
      <aside className="hidden lg:flex flex-col gap-1 p-4" style={{ background: softTint }}>
        <Link href={logoHref} className="flex items-center gap-2 mb-1 px-2">
          <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
          <span className="font-semibold text-lg">{logoLabel}</span>
        </Link>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-between border-l-[3px]"
              style={
                active
                  ? { background: 'white', boxShadow: 'var(--shadow-card)', borderLeftColor: accent, color: accent }
                  : { color: 'var(--foreground-muted, #4b5563)', borderLeftColor: 'transparent' }
              }
            >
              {item.label}
              {!!item.badge && (
                <span className="text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{item.badge}</span>
              )}
            </Link>
          )
        })}
        {accountContent}
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
