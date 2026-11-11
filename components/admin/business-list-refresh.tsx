'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function BusinessListRefresh() {
  const router = useRouter(), [pending, start] = useTransition()
  return <button type="button" disabled={pending} onClick={() => start(() => router.refresh())} className="flex items-center gap-1 text-xs text-[var(--accent-hover)]"><RefreshCw size={13} className={pending ? 'animate-spin' : ''} />{pending ? 'Se actualizează…' : 'Actualizează'}</button>
}
