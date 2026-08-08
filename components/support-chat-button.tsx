'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export function SupportChatButton() {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (subject.trim().length < 2 || message.trim().length < 5) {
      setError('Completează subiectul și un mesaj cu detalii.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/business/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Nu am putut trimite. Încearcă din nou.')
        return
      }
      setSent(true)
      setSubject('')
      setMessage('')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSending(false)
    }
  }

  function close() {
    setOpen(false)
    setSent(false)
    setError('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Suport"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: 'var(--accent)', color: 'white' }}
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/20 sm:bg-transparent" onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:w-96 sm:mr-5 sm:mb-5 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Contactează suportul</h2>
              <button onClick={close} aria-label="Închide">
                <X size={18} />
              </button>
            </div>

            {sent ? (
              <div className="py-4">
                <p className="text-sm text-gray-600 mb-4">
                  Mesajul a fost trimis. Îți răspundem cât de curând posibil.
                </p>
                <button onClick={close} className="btn-secondary w-full">
                  Închide
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm text-gray-500 mb-1">
                  Ai o problemă sau o întrebare? Scrie-ne aici, ajunge direct la echipa bookeasy.
                </p>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subiect (ex: Nu primesc mesaje pe WhatsApp)"
                  className="input-field"
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descrie problema în detaliu..."
                  className="input-field min-h-[100px]"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button onClick={submit} disabled={sending} className="btn-primary w-full">
                  {sending ? 'Se trimite...' : 'Trimite'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
