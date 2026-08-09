'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { MessageCircle, Send, CheckCircle2 } from 'lucide-react'

type ConversationSummary = {
  id: string
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  externalUserId: string
  customerName: string | null
  customerId: string | null
  needsOperator: boolean
  updatedAt: string
  lastMessage: { text: string; direction: 'IN' | 'OUT'; createdAt: string } | null
}

type Message = { id: string; direction: 'IN' | 'OUT'; text: string; createdAt: string }

const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Messenger' }

export default function InboxManager() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/business/conversations')
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } catch {
      // ignorăm eșecul unei reîmprospătări periodice — nu deranjăm utilizatorul
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
    // reîmprospătare periodică — echivalentul unui inbox "aproape live", fără websockets
    const timer = setInterval(loadConversations, 15000)
    return () => clearInterval(timer)
  }, [loadConversations])

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetchWithTimeout(`/api/business/conversations/${id}/messages`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    loadMessages(selectedId)
    const timer = setInterval(() => loadMessages(selectedId), 8000)
    return () => clearInterval(timer)
  }, [selectedId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendReply() {
    if (!selectedId || !draft.trim()) return
    setSending(true)
    try {
      const res = await fetchWithTimeout(`/api/business/conversations/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ?? 'Trimiterea a eșuat.')
        return
      }
      setDraft('')
      await Promise.all([loadMessages(selectedId), loadConversations()])
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSending(false)
    }
  }

  async function markResolved() {
    if (!selectedId) return
    try {
      await fetchWithTimeout(`/api/business/conversations/${selectedId}/resolve`, { method: 'POST' })
      await loadConversations()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  const selected = conversations.find((c) => c.id === selectedId)

  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-40px)] flex flex-col lg:flex-row">
      {/* lista de conversații */}
      <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border-soft)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <h1 className="text-xl font-semibold">Mesaje</h1>
          <p className="text-xs text-gray-500 mt-0.5">WhatsApp și Messenger, într-un singur loc.</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <p className="text-sm text-gray-400 p-4">Se încarcă...</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">Nicio conversație încă.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left p-4 border-b border-[var(--border-soft)] hover:bg-[var(--surface-muted)] transition"
                style={selectedId === c.id ? { background: 'var(--accent-soft)' } : {}}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate">{c.customerName ?? c.externalUserId}</p>
                  {c.needsOperator && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ml-2" />}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {c.lastMessage ? `${c.lastMessage.direction === 'OUT' ? 'Tu: ' : ''}${c.lastMessage.text}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{CHANNEL_LABEL[c.channel]}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* fereastra de conversație */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
              Alege o conversație din listă.
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between">
              <div>
                <p className="font-medium">{selected.customerName ?? selected.externalUserId}</p>
                <p className="text-xs text-gray-500">{CHANNEL_LABEL[selected.channel]}</p>
              </div>
              {selected.needsOperator && (
                <button onClick={markResolved} className="btn-secondary text-xs flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Marchează rezolvat
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {loadingMessages ? (
                <p className="text-sm text-gray-400">Se încarcă...</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`max-w-[75%] ${m.direction === 'OUT' ? 'self-end' : 'self-start'}`}>
                    <div
                      className="rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap"
                      style={
                        m.direction === 'OUT'
                          ? { background: 'var(--accent)', color: 'white' }
                          : { background: 'var(--surface-muted)' }
                      }
                    >
                      {m.text}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 px-1">
                      {new Date(m.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })}
                    </p>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-[var(--border-soft)] flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder="Scrie un răspuns..."
                className="input-field flex-1"
              />
              <button onClick={sendReply} disabled={sending || !draft.trim()} className="btn-primary p-2.5" aria-label="Trimite">
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
