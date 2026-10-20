'use client'

import { useState, useEffect, useRef, type CSSProperties, type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  User, PanelLeftClose, PanelLeftOpen, Menu, X, Calendar, MessagesSquare,
  ClipboardList, Users, Tag, Star, BarChart3, Settings, Stethoscope,
  ShieldCheck, Building2, Inbox, LifeBuoy, ChevronRight,
} from 'lucide-react'
import { SidebarClock } from './sidebar-clock'
import { CookiePreferencesButton } from './cookie-preferences-button'
import './workspace.css'

const NAV_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  calendar: Calendar, mesaje: MessagesSquare, programari: ClipboardList,
  clienti: Users, servicii: Tag, recenzii: Star, statistici: BarChart3,
  setari: Settings, medici: Stethoscope, superadmin: ShieldCheck,
  overview: BarChart3, afaceri: Building2, cereri: Inbox, tichete: LifeBuoy,
}
const COLLAPSE_KEY = 'bookeasy.sidebar.collapsed'

type NavItem = { href: string; label: string; badge?: number; icon?: string }
type Props = {
  logoHref: string
  logoLabel: string
  profileName?: string
  navItems: NavItem[]
  accentColor?: string
  accountContent: ReactNode
  children: ReactNode
  enableLiveBadges?: boolean
}

export function ResponsiveShell({
  logoHref, logoLabel, profileName, navItems, accentColor,
  accountContent, children, enableLiveBadges = false,
}: Props) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [liveBadges, setLiveBadges] = useState<Record<string, number | undefined>>({})
  const accountDialog = useRef<HTMLDialogElement>(null)
  const menuDialog = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  const accent = accentColor && /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : '#147f83'

  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true') } catch { /* Storage is optional. */ }
  }, [])

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, String(next)) } catch { /* Private browsing may deny storage. */ }
  }

  useEffect(() => {
    setAccountOpen(false)
    setMobileMenuOpen(false)
  }, [pathname])

  // Native dialogs provide Escape, focus trapping and focus restoration.
  useEffect(() => {
    const dialog = accountDialog.current
    if (!dialog) return
    if (accountOpen && !dialog.open) dialog.showModal()
    if (!accountOpen && dialog.open) dialog.close()
  }, [accountOpen])
  useEffect(() => {
    const dialog = menuDialog.current
    if (!dialog) return
    if (mobileMenuOpen && !dialog.open) dialog.showModal()
    if (!mobileMenuOpen && dialog.open) dialog.close()
  }, [mobileMenuOpen])

  useEffect(() => {
    setLiveBadges({})
    if (!enableLiveBadges) return
    let cancelled = false
    const controller = new AbortController()
    async function poll() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/business/notification-counts', { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setLiveBadges({
          '/dashboard/mesaje': data.needsOperatorCount > 0 ? data.needsOperatorCount : undefined,
          '/dashboard/programari': data.unseenConfirmationsCount > 0 ? data.unseenConfirmationsCount : undefined,
        })
      } catch { /* Retain the last successful counts until the next refresh. */ }
    }
    void poll()
    const timer = setInterval(poll, 30000)
    document.addEventListener('visibilitychange', poll)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [enableLiveBadges, profileName])

  const items = enableLiveBadges
    ? navItems.map(item => ({ ...item, badge: item.href in liveBadges ? liveBadges[item.href] : item.badge }))
    : navItems
  const activeHref = navItems
    .filter(item => pathname === item.href || pathname?.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
  const dashboardItems = items.filter(item => ['/dashboard/calendar', '/dashboard/mesaje', '/dashboard/programari'].includes(item.href))
  const mobileItems = dashboardItems.length ? dashboardItems : items.slice(0, 3)
  const otherItems = items.filter(item => !mobileItems.some(primary => primary.href === item.href))

  function badge(item: NavItem, mobile = false) {
    if (!item.badge) return null
    return <span className={mobile ? 'mobile-bottom-nav-badge' : 'be-nav-badge'} aria-label={`${item.badge} notificări`}>{item.badge > 99 ? '99+' : item.badge}</span>
  }

  return (
    <div className="app-shell-theme be-workspace" data-collapsed={sidebarCollapsed} style={{ '--workspace-accent': accent } as CSSProperties}>
      <a className="be-skip-link screen-only" href="#workspace-content">Sari la con&#539;inut</a>
      <header className="be-mobile-header screen-only">
        <Link href={logoHref} prefetch={false} className="be-brand">
          <Image src="/logo-mark-square.png" alt="" width={34} height={34} />
          <span><strong>{logoLabel}</strong>{profileName && <small>{profileName}</small>}</span>
        </Link>
        <button type="button" onClick={() => setAccountOpen(true)} aria-label="Deschide contul" className="be-icon-button be-account-trigger"><User size={19} /></button>
      </header>

      <aside className="app-shell-sidebar be-sidebar screen-only" aria-label="Meniu principal">
        <div className="be-brand-row">
          <Link href={logoHref} prefetch={false} className="be-brand" aria-label={logoLabel} title={sidebarCollapsed ? logoLabel : undefined}>
            <Image src="/logo-mark-square.png" alt="" width={38} height={38} />
            {!sidebarCollapsed && <span className="be-brand-wordmark">{logoLabel}</span>}
          </Link>
          {!sidebarCollapsed && <button type="button" onClick={toggleSidebar} className="be-icon-button be-collapse-button" aria-label="Restrânge meniul" title="Restrânge meniul"><PanelLeftClose size={17} /></button>}
        </div>
        {sidebarCollapsed ? (
          <button type="button" onClick={toggleSidebar} className="be-icon-button be-expand-button" aria-label="Extinde meniul" title="Extinde meniul"><PanelLeftOpen size={19} /></button>
        ) : (
          <div className="be-workspace-profile">
            <span className="be-eyebrow">SPA&#538;IU DE LUCRU</span>
            <p title={profileName ?? logoLabel}>{profileName ?? logoLabel}</p>
            <div className="be-workspace-clock"><SidebarClock /></div>
          </div>
        )}

        <nav className="be-sidebar-nav" aria-label="Navigare principală">
          {!sidebarCollapsed && <p className="be-nav-caption">PRINCIPAL</p>}
          {items.map(item => {
            const active = item.href === activeHref
            const Icon = item.icon ? NAV_ICONS[item.icon] : undefined
            const management = item.href.endsWith('/setari') || item.icon === 'superadmin'
            return <Link key={item.href} href={item.href} prefetch={false}
              aria-current={active ? 'page' : undefined} aria-label={item.label}
              title={sidebarCollapsed ? item.label : undefined}
              className={`be-nav-item${active ? ' is-active' : ''}${management ? ' be-nav-management' : ''}`}>
              {Icon && <span className="be-nav-icon"><Icon size={19} /></span>}
              {!sidebarCollapsed && <span className="be-nav-label">{item.label}</span>}
              {badge(item)}
              {active && !sidebarCollapsed && !item.badge && <ChevronRight size={14} />}
            </Link>
          })}
        </nav>

        <div className="be-sidebar-footer">
          {sidebarCollapsed ? <button type="button" className="be-icon-button be-account-trigger" onClick={() => setAccountOpen(true)} aria-label="Deschide contul" title="Cont"><User size={20} /></button> : <>
            {accountContent}
            <CookiePreferencesButton className="be-cookie-link" />
          </>}
        </div>
      </aside>

      <main id="workspace-content" tabIndex={-1} className="app-shell-content be-main">{children}</main>

      <nav aria-label="Navigare mobilă" className="mobile-bottom-nav be-bottom-nav screen-only">
        {mobileItems.map(item => {
          const Icon = item.icon ? NAV_ICONS[item.icon] : undefined
          return <Link key={item.href} href={item.href} prefetch={false} aria-current={item.href === activeHref ? 'page' : undefined} className={`mobile-bottom-nav-item${item.href === activeHref ? ' is-active' : ''}`}>
            <span className="relative">{Icon && <Icon size={21} />}{badge(item, true)}</span><span>{item.label}</span>
          </Link>
        })}
        <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Mai mult" aria-expanded={mobileMenuOpen} className={`mobile-bottom-nav-item${otherItems.some(item => item.href === activeHref) ? ' is-active' : ''}`}><Menu size={21} /><span>Mai mult</span></button>
      </nav>

      <dialog ref={menuDialog} className="be-menu-dialog screen-only" aria-label="Mai mult" onClose={() => setMobileMenuOpen(false)} onClick={event => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}>
        <div className="be-dialog-panel">
          <div className="be-dialog-heading"><h2>Toate sec&#539;iunile</h2><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Închide meniul" className="be-icon-button"><X size={20} /></button></div>
          <div className="be-menu-grid">{otherItems.map(item => {
            const Icon = item.icon ? NAV_ICONS[item.icon] : undefined
            return <Link key={item.href} href={item.href} prefetch={false} onClick={() => setMobileMenuOpen(false)} aria-current={item.href === activeHref ? 'page' : undefined} className="be-menu-tile">{Icon && <Icon size={21} />}<span>{item.label}</span>{badge(item)}</Link>
          })}</div>
          <CookiePreferencesButton onOpen={() => setMobileMenuOpen(false)} className="be-cookie-link" />
        </div>
      </dialog>

      <dialog ref={accountDialog} className="be-account-dialog screen-only" aria-label="Cont" onClose={() => setAccountOpen(false)} onClick={event => { if (event.target === event.currentTarget) setAccountOpen(false) }}>
        <div className="be-dialog-panel">
          <div className="be-dialog-heading"><h2>Contul t&#259;u</h2><button type="button" onClick={() => setAccountOpen(false)} aria-label="Închide contul" className="be-icon-button"><X size={20} /></button></div>
          {/* Keep this subtree mounted when closing so support portals remain usable. */}
          <div onClick={() => setAccountOpen(false)}>{accountContent}</div>
        </div>
      </dialog>
    </div>
  )
}
