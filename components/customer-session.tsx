'use client'

import { useEffect, useRef } from 'react'
import { getSession, SessionProvider, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function SessionSync() {
  const { data, status } = useSession()
  const router = useRouter()
  const previous = useRef<string | undefined>(undefined)
  const identity = status === 'loading' ? undefined : `${data?.user?.email ?? ''}:${(data as { role?: string } | null)?.role ?? ''}`

  useEffect(() => {
    if (identity === undefined || previous.current === identity) return
    const initial = previous.current === undefined
    previous.current = identity
    // Invalidate a client-side profile cached before sign-in, or after sign-out
    // in another tab. An anonymous first visit does not need an extra refresh.
    if (!initial || status === 'authenticated') router.refresh()
  }, [identity, status, router])

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) void getSession().then(() => router.refresh()).catch(() => {})
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [router])
  return null
}

export default function CustomerSession({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor
    const standaloneIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && (Boolean((navigator as Navigator & { standalone?: boolean }).standalone) || window.matchMedia('(display-mode: standalone)').matches)
    const nativeIos = Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios')
    document.documentElement.classList.toggle('bookeasy-native-ios', nativeIos)
    document.documentElement.classList.toggle('bookeasy-standalone-ios', standaloneIos && !nativeIos)
  }, [])
  return (
    <SessionProvider refetchInterval={15 * 60} refetchOnWindowFocus refetchWhenOffline={false}>
      <SessionSync />
      {children}
    </SessionProvider>
  )
}
