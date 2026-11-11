'use client'

import { useCallback, useEffect, useState } from 'react'
import EmailHtmlView from './email-html-view'

type EmailRow = {
  id: string; direction: string; folder: string; fromAddress: string; toAddresses: unknown
  subject: string; bodyText: string; isRead: boolean; receivedAt: string | null; sentAt: string | null; createdAt: string
}
type Attachment = { id: string; filename: string; contentType: string; contentId: string | null; size: number | null; available: boolean }
type EmailDetail = EmailRow & { replyTo: string | null; bodyHtml: string | null; attachments: Attachment[] }
type ListResponse = { rows: EmailRow[]; total: number; unread: number; page: number; pages: number; configured: boolean; address: string }
type Folder = 'inbox' | 'sent' | 'archive' | 'trash'
const folders: { id: Folder; label: string }[] = [
  { id: 'inbox', label: 'Primite' }, { id: 'sent', label: 'Trimise' },
  { id: 'archive', label: 'Arhivate' }, { id: 'trash', label: 'Șterse' },
]

function displayDate(email: EmailRow) {
  return new Date(email.receivedAt || email.sentAt || email.createdAt).toLocaleString('ro-RO', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest',
  })
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: 'no-store', ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Operațiunea a eșuat.')
  return data
}

export default function EmailInbox() {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<ListResponse | null>(null)
  const [selected, setSelected] = useState<EmailDetail | null>(null)
  const [compose, setCompose] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ folder, page: String(page), q: query })
      setList(await api(`/api/superadmin/email?${params}`))
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Inboxul nu a putut fi încărcat.') }
  }, [folder, page, query])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) refresh() }, 20000)
    return () => clearInterval(timer)
  }, [refresh])

  async function open(id: string) {
    try {
      setSelected(await api(`/api/superadmin/email/${id}`))
      setReply('')
      refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Mesajul nu poate fi deschis.') }
  }

  async function update(id: string, changes: Record<string, unknown>) {
    try {
      await api(`/api/superadmin/email/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
      setSelected(null)
      refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Actualizarea a eșuat.') }
  }

  async function remove() {
    if (!selected) return
    if (selected.folder === 'trash' && !confirm('Ștergi definitiv acest email și atașamentele?')) return
    try {
      await api(`/api/superadmin/email/${selected.id}${selected.folder === 'trash' ? '?permanent=1' : ''}`, { method: 'DELETE' })
      setSelected(null)
      refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Ștergerea a eșuat.') }
  }

  async function send(isReply: boolean) {
    setBusy(true)
    setError('')
    try {
      const path = isReply ? `/api/superadmin/email/${selected?.id}/reply` : '/api/superadmin/email/send'
      await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isReply ? { message: reply } : { to, subject, message }) })
      if (isReply) setReply('')
      else { setCompose(false); setTo(''); setSubject(''); setMessage('') }
      refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Trimiterea a eșuat.') }
    finally { setBusy(false) }
  }

  return <div className="dashboard-page">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div><h1 className="text-2xl font-semibold">Email · contact@bookeasy.ro</h1>
        <p className="text-sm text-gray-500">Inboxul platformei, vizibil doar pentru Super Admin.</p></div>
      <button className="btn-primary" onClick={() => { setCompose(true); setSelected(null) }}>Scrie email</button>
    </div>
    {list && !list.configured && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 mb-4">Configurarea Resend nu este completă. Verifică RESEND_API_KEY, RESEND_WEBHOOK_SECRET și BLOB_READ_WRITE_TOKEN în Vercel.</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</p>}
    <div className="flex flex-wrap gap-2 mb-4">
      {folders.map((item) => <button key={item.id} onClick={() => { setFolder(item.id); setPage(1); setSelected(null); setCompose(false) }}
        className={folder === item.id ? 'btn-primary' : 'btn-secondary'}>{item.label}{item.id === 'inbox' && list?.unread ? ` (${list.unread})` : ''}</button>)}
      <button className="btn-secondary" onClick={refresh}>Actualizează</button>
    </div>
    <input className="input-field w-full mb-4" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Caută după expeditor, subiect sau conținut" />
    <div className="grid gap-4 lg:grid-cols-[minmax(250px,1fr)_minmax(350px,2fr)]">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white overflow-hidden">
        {list?.rows.map((email) => <button key={email.id} onClick={() => { setCompose(false); open(email.id) }}
          className={`block w-full text-left p-4 border-b border-[var(--border-soft)] hover:bg-gray-50 ${selected?.id === email.id ? 'bg-teal-50' : ''}`}>
          <div className="flex justify-between gap-2"><span className={email.isRead ? 'text-sm' : 'text-sm font-semibold'}>{email.direction === 'outbound' ? String((email.toAddresses as string[])?.join(', ') || '') : email.fromAddress}</span>
            {!email.isRead && <span className="text-teal-600">●</span>}</div>
          <div className={email.isRead ? 'text-sm mt-1' : 'text-sm font-semibold mt-1'}>{email.subject}</div>
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{email.bodyText}</div>
          <div className="text-xs text-gray-400 mt-2">{displayDate(email)}</div>
        </button>)}
        {list && list.rows.length === 0 && <p className="p-6 text-sm text-gray-500">Niciun mesaj în acest folder.</p>}
        {list && list.pages > 1 && <div className="p-3 flex items-center justify-between text-sm">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Înapoi</button>
          <span>{page} / {list.pages}</span><button className="btn-secondary" disabled={page >= list.pages} onClick={() => setPage(page + 1)}>Înainte</button>
        </div>}
      </div>
      <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-5 min-h-[360px]">
        {compose ? <div className="space-y-3">
          <h2 className="text-lg font-semibold">Email nou</h2>
          <input className="input-field w-full" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destinatar" />
          <input className="input-field w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subiect" />
          <textarea className="input-field w-full min-h-[220px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mesaj" />
          <button className="btn-primary" disabled={busy} onClick={() => send(false)}>{busy ? 'Se trimite...' : 'Trimite'}</button>
        </div> : selected ? <div>
          <h2 className="text-lg font-semibold break-words">{selected.subject}</h2>
          <p className="text-sm text-gray-500 mt-2 break-words">De la: {selected.fromAddress}<br />Către: {Array.isArray(selected.toAddresses) ? selected.toAddresses.join(', ') : ''}<br />{displayDate(selected)}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="btn-secondary" onClick={() => update(selected.id, { folder: selected.folder === 'archive' ? 'inbox' : 'archive' })}>{selected.folder === 'archive' ? 'Mută în primite' : 'Arhivează'}</button>
            <button className="btn-secondary" onClick={() => update(selected.id, { isRead: false })}>Marchează necitit</button>
            <button className="btn-secondary" onClick={remove}>{selected.folder === 'trash' ? 'Șterge definitiv' : 'Mută la șterse'}</button>
          </div>
          {selected.attachments.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{selected.attachments.map((attachment) =>
            attachment.available ? <a className="btn-secondary" key={attachment.id} href={`/api/superadmin/email/${selected.id}/attachments/${attachment.id}`}>📎 {attachment.filename}</a>
              : <span className="text-xs text-gray-400" key={attachment.id}>{attachment.filename} indisponibil</span>)}</div>}
          {selected.bodyHtml
            ? <EmailHtmlView key={selected.id} emailId={selected.id} html={selected.bodyHtml} attachments={selected.attachments} />
            : <pre className="whitespace-pre-wrap break-words font-sans text-sm mt-5 border-t border-[var(--border-soft)] pt-5">{selected.bodyText || '(mesaj fără text)'}</pre>}
          {selected.direction === 'inbound' && <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
            <label className="text-sm font-medium">Răspunde către {selected.replyTo || selected.fromAddress}</label>
            <textarea className="input-field w-full min-h-[130px] mt-2" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Scrie răspunsul..." />
            <button className="btn-primary mt-2" disabled={busy || !reply.trim()} onClick={() => send(true)}>{busy ? 'Se trimite...' : 'Trimite răspunsul'}</button>
          </div>}
        </div> : <p className="text-sm text-gray-500">Selectează un mesaj din listă.</p>}
      </div>
    </div>
  </div>
}
