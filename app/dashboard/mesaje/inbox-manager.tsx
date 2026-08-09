'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { MessageCircle, Send, CheckCircle2, FileText } from 'lucide-react'

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
type Template = { id: string; title: string; text: string }

const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Messenger' }
const OPERATOR_NAME_KEY = 'bookeasy_operator_name'

export default function InboxManager() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [operatorName, setOperatorName] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOperatorName(localStorage.getItem(OPERATOR_NAME_KEY) ?? '')
    fetchWithTimeout('/api/business/message-templates')
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setTemplates([]))
  }, [])

  function updateOperatorName(name: string) {
    setOperatorName(name)
    localStorage.setItem(OPERATOR_NAME_KEY, name)
  }

  // reîmprospătarea din fundal e SILENȚIOASĂ — nu arătăm "Se încarcă..." decât la
  // prima încărcare, altfel lista/mesajele ar clipi vizibil la fiecare interval
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true)
    try {
      const res = await fetchWithTimeout('/api/business/conversations')
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } catch {
      // reîmprospătare eșuată — încercăm din nou la următorul interval, fără să deranjăm
    } finally {
      if (!silent) setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    loadConversations(false)
    const timer = setInterval(() => loadConversations(true), 15000)
    return () => clearInterval(timer)
  }, [loadConversations])

  const loadMessages = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoadingMessages(true)
    try {
      const res = await fetchWithTimeout(`/api/business/conversations/${id}/messages`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      if (!silent) setMessages([])
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    loadMessages(selectedId, false)
    const timer = setInterval(() => loadMessages(selectedId, true), 8000)
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
        body: JSON.stringify({ text: draft, operatorName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ?? 'Trimiterea a eșuat.')
        return
      }
      setDraft('')
      await Promise.all([loadMessages(selectedId, true), loadConversations(true)])
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
      await loadConversations(true)
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  const selected = conversations.find((c) => c.id === selectedId)
  const anyNeedsOperator = conversations.some((c) => c.needsOperator)

  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-40px)] flex flex-col lg:flex-row">
      {/* lista de conversații */}
      <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border-soft)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            Mesaje
            {anyNeedsOperator && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">WhatsApp și Messenger, într-un singur loc.</p>
          <input
            value={operatorName}
            onChange={(e) => updateOperatorName(e.target.value)}
            placeholder="Numele tău (apare la client)"
            className="input-field text-sm w-full"
          />
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
                  {c.needsOperator && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ml-2 animate-pulse" />}
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
              ) : messages.length === 0 ? (
                <p className="text-sm text-gray-400">Nimic de-arătat încă — conversația a pornit de la cererea de operator.</p>
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

            {showTemplates && templates.length > 0 && (
              <div className="border-t border-[var(--border-soft)] p-2 max-h-40 overflow-y-auto flex flex-col gap-1">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setDraft(t.text)
                      setShowTemplates(false)
                    }}
                    className="text-left text-sm px-3 py-2 rounded-lg hover:bg-[var(--surface-muted)]"
                  >
                    <span className="font-medium">{t.title}</span>
                    <span className="text-gray-400"> — {t.text.slice(0, 50)}{t.text.length > 50 ? '...' : ''}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-[var(--border-soft)] flex items-center gap-2">
              {templates.length > 0 && (
                <button
                  onClick={() => setShowTemplates((v) => !v)}
                  aria-label="Șabloane de mesaje"
                  title="Șabloane de mesaje"
                  className="btn-secondary p-2.5 shrink-0"
                >
                  <FileText size={18} />
                </button>
              )}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder="Scrie un răspuns..."
                className="input-field flex-1"
              />
              <button onClick={sendReply} disabled={sending || !draft.trim()} className="btn-primary p-2.5 shrink-0" aria-label="Trimite">
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
