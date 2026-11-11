'use client'

import { useState, useEffect } from 'react'
import { User, MessageCircle } from 'lucide-react'
import { SignOutButton } from './sign-out-button'
import { SupportChatPanel } from './support-chat-button'

export function SidebarUserBlock({ label, status = 'Activ', showSupport = false, supportUnread = 0 }: { label: string; status?: string; showSupport?: boolean; supportUnread?: number }) {
  const [supportOpen, setSupportOpen] = useState(false)
  const [unread, setUnread] = useState(supportUnread)
  useEffect(() => {
    if (!showSupport) return
    const counts = (event:Event) => setUnread((event as CustomEvent).detail?.supportUnread ?? 0)
    const refresh = () => { void fetch('/api/business/notification-counts').then(r=>r.ok?r.json():null).then(data=>{if(data)setUnread(data.supportUnread??0)}).catch(()=>{}) }
    window.addEventListener('bookeasy-notification-counts',counts);window.addEventListener('bookeasy-support-changed',refresh)
    return()=>{window.removeEventListener('bookeasy-notification-counts',counts);window.removeEventListener('bookeasy-support-changed',refresh)}
  },[showSupport])

  return (
    <div className="pt-2">
      <div className="h-px bg-[var(--border-soft)] mb-3" />
      <div className="flex items-center gap-2.5 px-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-sm">
          <User size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            {status}
          </p>
        </div>
      </div>
      {showSupport && (
        <button
          onClick={() => setSupportOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-white hover:shadow-sm transition mb-1"
        >
          <MessageCircle size={15} /> Suport tehnic {unread>0&&<span aria-label={`${unread} conversații necitite`} className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs text-white">{unread}</span>}
        </button>
      )}
      <SignOutButton className="w-full" />
      {showSupport && <SupportChatPanel open={supportOpen} onClose={() => setSupportOpen(false)} />}
    </div>
  )
}
