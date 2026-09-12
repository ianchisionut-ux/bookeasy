'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { MessageCircle, Send, CheckCircle2, FileText, X, CalendarPlus, RotateCcw } from 'lucide-react'
import { WorkingRange } from '@/components/working-date-time-picker'

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
type BusinessCategory = 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'

function getQuickReplies(category: BusinessCategory) {
  if (category === 'CLINICA') return [
    { label: '👋 Salut', text: 'Bună ziua! Cu ce vă putem ajuta?' },
    { label: '🔎 Verific medicul', text: 'Verific disponibilitatea medicului și revin imediat cu intervalele libere.' },
    { label: '📅 Alte intervale', text: 'Intervalul solicitat nu mai este disponibil. Vă pot propune o altă oră pentru consultație.' },
    { label: '✅ Confirmată', text: 'Programarea dumneavoastră este confirmată. Vă așteptăm la data și ora stabilite.' },
    { label: '🪪 Documente', text: 'Vă rugăm să aveți la dumneavoastră actul de identitate și documentele medicale relevante.' },
    { label: '⌛ Întârziere', text: 'Ne cerem scuze pentru întârziere. Medicul vă va prelua cât mai curând posibil.' },
    { label: '🔁 Reprogramare', text: 'Sigur, vă putem ajuta cu reprogramarea. Ce zi sau interval orar preferați?' },
    { label: '🙏 Mulțumim', text: 'Vă mulțumim! Multă sănătate și vă mai așteptăm.' },
  ]

  if (category === 'EVENT_VENUE' || category === 'HOTEL' || category === 'PENSIUNE') return [
    { label: '👋 Salut', text: 'Bună ziua! Cu ce detalii despre rezervare vă putem ajuta?' },
    { label: '🔎 Verific data', text: 'Verific disponibilitatea locației pentru data solicitată și revin imediat.' },
    { label: '📅 Data ocupată', text: 'Din păcate, data solicitată nu mai este disponibilă. Vă putem propune date alternative.' },
    { label: '✅ Rezervată', text: 'Rezervarea este confirmată pentru data stabilită. Vă mulțumim!' },
    { label: '👥 Detalii eveniment', text: 'Pentru o ofertă exactă, ne puteți spune data, numărul estimat de persoane și tipul evenimentului?' },
    { label: '💳 Avans', text: 'Pentru confirmarea rezervării este necesar avansul. Vă trimit imediat detaliile de plată.' },
    { label: '📍 Vizionare', text: 'Putem stabili o vizionare a locației. Ce zi și ce interval orar vă sunt potrivite?' },
    { label: '🙏 Mulțumim', text: 'Vă mulțumim pentru interes! Rămânem la dispoziția dumneavoastră.' },
  ]

  return [
    { label: '👋 Salut', text: 'Bună! Cu ce te putem ajuta?' },
    { label: '🔎 Verific', text: 'Verific disponibilitatea specialistului și revin imediat cu orele libere.' },
    { label: '📅 Altă oră', text: 'Ora solicitată nu mai este disponibilă. Îți pot propune un alt interval.' },
    { label: '✅ Confirmată', text: 'Programarea ta este confirmată. Te așteptăm!' },
    { label: '✂️ Ce serviciu?', text: 'Pentru ce serviciu dorești programarea și ce zi ți-ar fi potrivită?' },
    { label: '⌛ Întârziere', text: 'Ne cerem scuze pentru întârziere și îți mulțumim pentru răbdare.' },
    { label: '🔁 Reprogramare', text: 'Sigur, te ajutăm cu reprogramarea. Ce zi sau interval orar preferi?' },
    { label: '🙏 Mulțumim', text: 'Mulțumim! Te mai așteptăm cu drag.' },
  ]
}

function splitOperatorPrefix(text: string) {
  const match = text.match(/^\*([^*:\n]{1,60}):\*\s*/)
  return match ? { operator: match[1].trim(), text: text.slice(match[0].length) } : { operator: null, text }
}

export default function InboxManager({ businessId, category, isClinic, isAppointmentBased }: { businessId: string; category: BusinessCategory; isClinic: boolean; isAppointmentBased: boolean }) {
  const operatorNameKey = `bookeasy_operator_name_${businessId}`
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
  const [showBookingModal, setShowBookingModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const quickReplies = getQuickReplies(category)

  useEffect(() => {
    setOperatorName(localStorage.getItem(operatorNameKey) ?? '')
    fetchWithTimeout('/api/business/message-templates')
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setTemplates([]))
  }, [])

  function updateOperatorName(name: string) {
    setOperatorName(name)
    localStorage.setItem(operatorNameKey, name)
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
    const timer = setInterval(() => loadConversations(true), 5000)
    return () => clearInterval(timer)
  }, [loadConversations])

  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id)
  }, [conversations, selectedId])

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
    loadConversations(true) // aducem starea proaspătă a lui needsOperator, nu una posibil învechită din ultimul polling
    const timer = setInterval(() => loadMessages(selectedId, true), 4000)
    return () => clearInterval(timer)
  }, [selectedId, loadMessages, loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendReply() {
    if (!selectedId || !draft.trim()) return
    if (!operatorName.trim()) {
      alert('Completează numele operatorului înainte să trimiți răspunsul.')
      return
    }
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

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Ștergi definitiv această conversație, cu tot istoricul de mesaje?')) return
    try {
      await fetchWithTimeout(`/api/business/conversations/${id}`, { method: 'DELETE' })
      if (selectedId === id) {
        setSelectedId(null)
        setMessages([])
      }
      await loadConversations(true)
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  const selected = conversations.find((c) => c.id === selectedId)
  const anyNeedsOperator = conversations.some((c) => c.needsOperator)

  return (
    <div className="h-[calc(100vh-56px)] lg:h-screen min-h-0 p-3 lg:p-5 flex flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-xl lg:text-2xl font-semibold">Mesaje</h1>
        <p className="mt-1 text-sm text-gray-500">Toate conversațiile de pe Messenger, Instagram și WhatsApp, într-un singur loc.</p>
      </div>
      <div className="card min-h-0 flex-1 overflow-hidden flex flex-col lg:flex-row border border-[var(--border-soft)]">
      {/* lista de conversații */}
      <div className="lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border-soft)] flex flex-col bg-white max-h-56 lg:max-h-none">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <label className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Numele tău (apare la client)
            {anyNeedsOperator && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </label>
          <input
            value={operatorName}
            onChange={(e) => updateOperatorName(e.target.value)}
            placeholder="Numele operatorului"
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
                className="w-full text-left px-4 py-3.5 border-b border-[var(--border-soft)] hover:bg-[var(--surface-muted)] transition relative group"
                style={selectedId === c.id ? { background: '#fff7e8', boxShadow: 'inset 3px 0 0 var(--accent)' } : {}}
              >
                <div className="flex items-center justify-between mb-1 pr-5">
                  <p className="text-sm font-medium truncate">{c.customerName ?? c.externalUserId}</p>
                  {c.needsOperator && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ml-2 animate-pulse" />}
                </div>
                <p className="text-xs text-gray-500 truncate pr-5">
                  {c.lastMessage ? (() => {
                    const parsed = splitOperatorPrefix(c.lastMessage.text)
                    return `${c.lastMessage.direction === 'OUT' ? `${parsed.operator ?? 'BookEasy'}: ` : ''}${parsed.text}`
                  })() : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{CHANNEL_LABEL[c.channel]}</p>
                <span
                  onClick={(e) => deleteConversation(c.id, e)}
                  role="button"
                  aria-label="Șterge conversația"
                  className="absolute top-3 right-3 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={16} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* fereastra de conversație */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#f6f7f9]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
              Alege o conversație din listă.
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3.5 border-b border-[var(--border-soft)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white">
              <div>
                <p className="font-medium">{selected.customerName ?? selected.externalUserId}</p>
                <p className="text-xs text-gray-500">{CHANNEL_LABEL[selected.channel]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowBookingModal(true)} className="btn-secondary !px-3 !py-2 text-xs whitespace-nowrap flex items-center gap-1.5">
                  <CalendarPlus size={14} /> {isAppointmentBased ? 'Programare nouă' : 'Rezervare nouă'}
                </button>
                {selected.needsOperator && (
                  <button onClick={markResolved} className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCircle2 size={14} /> Marchează rezolvat
                  </button>
                )}
                <button onClick={markResolved} className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1.5 whitespace-nowrap">
                  <RotateCcw size={14} /> Repornește botul
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-5 flex flex-col gap-5">
              {loadingMessages ? (
                <p className="text-sm text-gray-400">Se încarcă...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-gray-400">Nimic de-arătat încă — conversația a pornit de la cererea de operator.</p>
              ) : (
                messages.map((m) => {
                  const parsed = splitOperatorPrefix(m.text)
                  const sender = m.direction === 'IN'
                    ? `${isClinic ? 'Pacient' : 'Client'}: ${selected.customerName ?? selected.externalUserId}`
                    : parsed.operator
                      ? `Operator: ${parsed.operator}`
                      : 'BookEasy · mesaj automat'
                  return (
                  <div key={m.id} className={`max-w-[88%] sm:max-w-[72%] ${m.direction === 'OUT' ? 'self-end' : 'self-start'}`}>
                    <p className={`mb-1 px-1 text-[10px] font-semibold ${m.direction === 'OUT' ? 'text-right text-[var(--accent-hover)]' : 'text-gray-500'}`}>{sender}</p>
                    <div
                      className="rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap border"
                      style={
                        m.direction === 'OUT'
                          ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                          : { background: 'white', borderColor: 'var(--border-soft)' }
                      }
                    >
                      {parsed.text}
                    </div>
                    <p className={`text-[10px] text-gray-400 mt-1 px-1 ${m.direction === 'OUT' ? 'text-right' : ''}`}>
                      {new Date(m.createdAt).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })}
                    </p>
                  </div>
                  )
                })
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

            <div className="border-t border-[var(--border-soft)] bg-white px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar">
              {quickReplies.map((reply) => (
                <button key={reply.label} onClick={() => setDraft(reply.text)} className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition">
                  {reply.label}
                </button>
              ))}
            </div>

            <div className="px-3 py-3 border-t border-[var(--border-soft)] bg-white flex items-end gap-2">
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
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendReply()
                  }
                }}
                placeholder="Scrie un răspuns..."
                rows={1}
                className="input-field flex-1 min-h-11 max-h-28 resize-y"
              />
              <button onClick={sendReply} disabled={sending || !draft.trim()} className="btn-primary !px-4 !py-3 shrink-0 flex items-center gap-2" aria-label="Trimite">
                <Send size={16} /><span className="hidden sm:inline">Trimite</span>
              </button>
            </div>

            {showBookingModal && (
              <QuickBookingModal
                isClinic={isClinic}
                isAppointmentBased={isAppointmentBased}
                conversation={selected}
                operatorName={operatorName}
                onClose={() => setShowBookingModal(false)}
                onCreated={() => {
                  setShowBookingModal(false)
                  loadConversations(true)
                }}
              />
            )}
          </>
        )}
      </div>
      </div>
    </div>
  )
}

function QuickBookingModal({
  conversation,
  operatorName,
  isClinic,
  isAppointmentBased,
  onClose,
  onCreated,
}: {
  conversation: ConversationSummary
  operatorName: string
  isClinic: boolean
  isAppointmentBased: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [services, setServices] = useState<{ id: string; name: string; durationMin: number | null }[]>([])
  const [practitioners, setPractitioners] = useState<{ id: string; name: string }[]>([])
  const [isMultiPractitioner, setIsMultiPractitioner] = useState(false)
  const [workingHours, setWorkingHours] = useState<WorkingRange[]>([])
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(10)
  const [loadingData, setLoadingData] = useState(true)

  const [customerName, setCustomerName] = useState(conversation.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(conversation.channel === 'WHATSAPP' ? conversation.externalUserId : '')
  const [serviceId, setServiceId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [daySlots, setDaySlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWithTimeout('/api/business/conversations/quick-booking-data')
      .then((res) => res.json())
      .then((data) => {
        setServices(data.services ?? [])
        setPractitioners(data.practitioners ?? [])
        setIsMultiPractitioner(!!data.isMultiPractitioner)
        setWorkingHours(data.workingHours ?? [])
        setSlotIntervalMinutes(data.slotIntervalMinutes ?? 10)
        if (data.practitioners?.length === 1) setPractitionerId(data.practitioners[0].id)
      })
      .catch(() => setError('Nu am putut încărca serviciile.'))
      .finally(() => setLoadingData(false))
  }, [])

  useEffect(() => {
    if (!serviceId || !slotDate || (isMultiPractitioner && !practitionerId)) {
      setDaySlots([])
      return
    }
    setLoadingSlots(true)
    setSelectedSlot('')
    fetchWithTimeout(`/api/business/practitioner-availability?serviceId=${serviceId}&date=${slotDate}${practitionerId ? `&practitionerId=${practitionerId}` : ''}`)
      .then((res) => res.json())
      .then((data) => setDaySlots(data.allSlots ?? []))
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [isMultiPractitioner, serviceId, practitionerId, slotDate])

  async function submit() {
    const hasDateInfo = !!selectedSlot
    if (!customerName.trim() || customerPhone.trim().length < 6 || !serviceId || !hasDateInfo) {
      setError('Completează numele, telefonul, serviciul și data.')
      return
    }
    if (isMultiPractitioner && !practitionerId) {
      setError('Alege persoana.')
      return
    }

    const service = services.find((s) => s.id === serviceId)
    const start = new Date(selectedSlot)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    if (start < new Date()) {
      setError(`Nu poți crea o ${isAppointmentBased ? 'programare' : 'rezervare'} într-un interval din trecut.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/business/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: conversation.customerId ?? undefined,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          serviceId,
          practitionerId: isMultiPractitioner ? practitionerId : undefined,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'A apărut o eroare. Verifică datele.')
        return
      }

      // trimitem și detaliile programării direct pe canalul clientului (WhatsApp/
      // Messenger/Instagram) — ca să știe exact ce s-a stabilit, fără să mai aștepte
      const practitioner = practitioners.find((p) => p.id === practitionerId)
      const dateTime = start.toLocaleString('ro-RO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Bucharest',
      })
      const detailsText = [
        `${isAppointmentBased ? 'Programarea' : 'Rezervarea'} ta a fost înregistrată!`,
        `Serviciu: ${service?.name ?? ''}`,
        ...(practitioner ? [`Persoana: ${practitioner.name}`] : []),
        `Data: ${dateTime}`,
      ].join('\n')

      await fetchWithTimeout(`/api/business/conversations/${conversation.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: detailsText, operatorName: operatorName.trim() || undefined }),
      }).catch(() => {})

      onCreated()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{isAppointmentBased ? 'Programare nouă' : 'Rezervare nouă'}</h2>
          <button onClick={onClose} aria-label="Închide">
            <X size={18} />
          </button>
        </div>

        {loadingData ? (
          <p className="text-sm text-gray-400">Se încarcă...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={isClinic ? 'Nume pacient' : 'Nume client'}
                className="input-field"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Telefon"
                className="input-field"
              />
            </div>

            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input-field w-full">
              <option value="">Alege serviciul</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {isMultiPractitioner ? (
              <>
                {practitioners.length > 1 && (
                  <select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} className="input-field w-full">
                    <option value="">Alege persoana</option>
                    {practitioners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="input-field w-full" />
                {practitionerId && serviceId && (
                  <div>
                    {loadingSlots ? (
                      <p className="text-sm text-gray-400">Se încarcă orele...</p>
                    ) : daySlots.length === 0 ? (
                      <p className="text-sm text-gray-500">Niciun program pentru această zi.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {daySlots.filter((slot) => slot.available).map((slot) => {
                          const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
                          if (!slot.available) {
                            return (
                              <span key={slot.time} className="py-2 rounded-lg text-center text-sm text-gray-300 border border-[var(--border-soft)] line-through">
                                {time}
                              </span>
                            )
                          }
                          const active = selectedSlot === slot.time
                          return (
                            <button
                              key={slot.time}
                              onClick={() => setSelectedSlot(slot.time)}
                              className="py-2 rounded-lg text-center text-sm font-medium border transition"
                              style={active ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}
                            >
                              {time}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div><input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="input-field w-full" />{serviceId && <div className="mt-3">{loadingSlots ? <p className="text-sm text-gray-400">Se încarcă orele...</p> : daySlots.filter(s=>s.available).length===0 ? <p className="text-sm text-gray-500">Nu mai sunt ore disponibile în această zi.</p> : <div className="grid grid-cols-4 gap-2">{daySlots.filter(s=>s.available).map(slot=>{const time=new Date(slot.time).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Bucharest'});const active=selectedSlot===slot.time;return <button key={slot.time} type="button" onClick={()=>setSelectedSlot(slot.time)} className="py-2 rounded-lg text-sm font-medium border" style={active?{background:'var(--accent)',color:'white',borderColor:'var(--accent)'}:{}}>{time}</button>})}</div>}</div>}</div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button onClick={submit} disabled={saving} className="btn-primary w-full">
              {saving ? 'Se salvează...' : `Salvează ${isAppointmentBased ? 'programarea' : 'rezervarea'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
