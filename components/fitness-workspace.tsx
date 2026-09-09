'use client'

import { useEffect, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'

type Entry = { id: string; kind: string; date: string; time: string; title: string; details: string; completed: boolean; feedback: string; version: number }
type Booking = { id: string; startAt: string; endAt: string; status: string; service: { name: string } }
type Message = { id: string; text: string; sender: string; createdAt: string }
type Customer = { id: string; name: string | null; fitnessClient: { id: string; active: boolean } | null }
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm'
const button = 'rounded-full bg-[#14142b] px-4 py-2 text-sm text-white disabled:opacity-50'
const emptyPlan = { kind: 'WORKOUT', date: '', time: '09:00', title: '', details: '' }

async function api(url: string, method = 'GET', body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, { method, signal, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await response.json().catch(() => null) : null
  if (!response.ok) throw new Error(data?.error || `Serverul nu a putut finaliza cererea (HTTP ${response.status}).`)
  if (!data) throw new Error('Serverul a trimis un răspuns invalid. Reîncarcă pagina și încearcă din nou.')
  return data
}

export default function FitnessWorkspace({ owner = false }: { owner?: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [tab, setTab] = useState('WORKOUT')
  const [entries, setEntries] = useState<Entry[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [older, setOlder] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null)
  const [clientName, setClientName] = useState('')
  const [timezone, setTimezone] = useState('Europe/Bucharest')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [revision, setRevision] = useState(0)
  const [syncedAt, setSyncedAt] = useState('')
  const [invite, setInvite] = useState('')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)
  const [plan, setPlan] = useState(emptyPlan)
  const [editorOpen, setEditorOpen] = useState(false)
  const [progress, setProgress] = useState<Entry | null>(null)
  const selected = customers.find(c => c.id === customerId)
  const clientId = selected?.fitnessClient?.id
  const query = owner ? `mode=instructor&clientId=${encodeURIComponent(clientId ?? '')}` : 'mode=client'
  const week = startOfWeek(new Date(`${selectedDate}T12:00:00`), { weekStartsOn: 1 })
  const from = format(week, 'yyyy-MM-dd'), to = format(addDays(week, 6), 'yyyy-MM-dd')

  useEffect(() => {
    if (!owner) return
    const controller = new AbortController()
    api('/api/fitness/clients', 'GET', undefined, controller.signal).then(d => setCustomers(d.customers)).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [owner, revision])

  useEffect(() => {
    setEntries([]); setBookings([]); setMessages([]); setOlder([]); setHasMoreOlder(null); setInvite(''); setLoaded(false); setEditorOpen(false); setProgress(null); setDraft('')
  }, [customerId])

  useEffect(() => {
    if (owner && !clientId) return
    const controller = new AbortController()
    let pending = false
    async function load() {
      if (pending || document.hidden || !navigator.onLine) return
      pending = true
      try {
        const data = await api(`/api/fitness/entries?${query}&from=${from}&to=${to}`, 'GET', undefined, controller.signal)
        if (controller.signal.aborted) return
        setEntries(data.entries); setBookings(data.bookings); setClientName(data.clientName || 'Client'); setTimezone(data.timezone)
        if (tab === 'MESSAGES') {
          const chat = await api(`/api/fitness/messages?${query}`, 'GET', undefined, controller.signal)
          if (controller.signal.aborted) return
          setMessages(chat.messages); setHasMore(chat.hasMore)
        }
        setLoaded(true); setSyncedAt(new Date().toLocaleTimeString('ro-RO'))
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Sincronizare eșuată.')
      } finally { pending = false }
    }
    void load()
    const timer = setInterval(load, 20000)
    document.addEventListener('visibilitychange', load); window.addEventListener('online', load)
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); window.removeEventListener('online', load) }
  }, [owner, clientId, query, from, to, tab, revision])

  async function action(fn: () => Promise<void>) {
    setBusy(true); setError('')
    try { await fn(); setRevision(r => r + 1) }
    catch (e) { setError(e instanceof Error ? e.message : 'Operațiune eșuată.') }
    finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{owner ? 'Fitness · planurile clienților' : `Planul meu${clientName ? ` · ${clientName}` : ''}`}</h1>
        <p className="mt-1 text-sm text-gray-500">Nutriție, antrenamente și comunicare într-un singur loc.</p></div>
      <button className={button} disabled={busy} onClick={() => { setError(''); setRevision(r => r + 1) }}>Actualizează</button>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {owner && <section className="rounded-2xl border bg-white p-4 space-y-3">
      <label className="block text-sm">Client
        <select disabled={busy} className={`${field} mt-1`} value={customerId} onChange={e => setCustomerId(e.target.value)}>
          <option value="">Alege clientul</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name || 'Client fără nume'}</option>)}
        </select>
      </label>
      <p className="text-sm text-gray-500">Adaugă persoane din <a href="/dashboard/clienti" className="underline">Clienți</a>, apoi activează portalul lor aici.</p>
      {selected && <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => action(async () => {
          const d = await api('/api/fitness/clients', 'POST', { customerId, action: 'invite' }); setInvite(d.inviteUrl)
        })}>{clientId ? 'Generează link nou de acces' : 'Activează portalul clientului'}</button>
        {selected.fitnessClient?.active && <button className="rounded-full border px-4 py-2 text-sm text-red-600" disabled={busy} onClick={() => {
          if (confirm('Revoci accesul clientului de pe toate dispozitivele? Planurile rămân salvate.')) void action(async () => { await api('/api/fitness/clients', 'POST', { customerId, action: 'revoke' }); setInvite('') })
        }}>Revocă accesul</button>}
        {selected.fitnessClient && !selected.fitnessClient.active && <span className="p-2 text-sm text-amber-700">Acces revocat</span>}
      </div>}
      {invite && <div className="rounded-xl bg-green-50 p-3 text-sm space-y-2">
        <p>Trimite privat acest link doar clientului selectat. Valabil 24 de ore, o singură utilizare. Oferă acces la planurile personale.</p>
        <input aria-label="Link privat de acces" className={field} readOnly value={invite} />
        <button className={button} onClick={() => action(async () => { await navigator.clipboard.writeText(invite) })}>Copiază linkul</button>
      </div>}
    </section>}
    {(!owner || clientId) && <>
      <nav aria-label="Calendare și mesaje Fitness" className="flex gap-2 overflow-x-auto pb-1">
        {[['WORKOUT', 'Antrenamente'], ['NUTRITION', 'Nutriție'], ['BOOKINGS', 'Programări'], ['MESSAGES', 'Mesaje']].map(([key, label]) => <button key={key} onClick={() => setTab(key)} aria-pressed={tab === key} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === key ? 'bg-[#14142b] text-white' : 'border bg-white'}`}>{label}</button>)}
      </nav>
      <p className="text-xs text-gray-500" role="status">{syncedAt ? `Ultima sincronizare: ${syncedAt}. Actualizare la 20 secunde cât timp pagina este vizibilă.` : 'Se încarcă…'} Ora locală: {timezone}.</p>
      {tab !== 'MESSAGES' && <div className="flex flex-wrap items-center gap-3">
        <button aria-label="Săptămâna precedentă" className="rounded-xl border p-2" onClick={() => setSelectedDate(format(addDays(week, -7), 'yyyy-MM-dd'))}>←</button>
        <label className="text-sm">Săptămâna din <input type="date" className="ml-2 rounded-xl border p-2" value={selectedDate} onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }} /></label>
        <button aria-label="Săptămâna următoare" className="rounded-xl border p-2" onClick={() => setSelectedDate(format(addDays(week, 7), 'yyyy-MM-dd'))}>→</button>
        {owner && ['NUTRITION', 'WORKOUT'].includes(tab) && <button className={button} onClick={() => { setEditing(null); setPlan({ ...emptyPlan, kind: tab, date: selectedDate }); setEditorOpen(true) }}>+ {tab === 'NUTRITION' ? 'Adaugă masă' : 'Adaugă antrenament'}</button>}
      </div>}
      {editorOpen && owner && <form className="rounded-2xl border bg-white p-4 space-y-3" onSubmit={e => {
        e.preventDefault(); void action(async () => {
          await api(`/api/fitness/entries${editing ? `/${editing.id}` : ''}?${query}`, editing ? 'PATCH' : 'POST', editing ? { ...plan, version: editing.version } : plan)
          setEditorOpen(false)
        })
      }}>
        <h2 className="font-semibold">{editing ? 'Modifică planul' : 'Plan nou'}</h2>
        <div className="grid gap-3 sm:grid-cols-2"><label>Data<input required type="date" className={field} value={plan.date} onChange={e => setPlan({ ...plan, date: e.target.value })} /></label>
          <label>Ora<input required type="time" className={field} value={plan.time} onChange={e => setPlan({ ...plan, time: e.target.value })} /></label></div>
        <label className="block">Titlu<input required maxLength={150} className={field} value={plan.title} onChange={e => setPlan({ ...plan, title: e.target.value })} placeholder={plan.kind === 'NUTRITION' ? 'Mic dejun' : 'Antrenament picioare'} /></label>
        <label className="block">Detalii<textarea maxLength={8000} rows={5} className={field} value={plan.details} onChange={e => setPlan({ ...plan, details: e.target.value })} placeholder={plan.kind === 'NUTRITION' ? 'Alimente, cantități, instrucțiuni…' : 'Exerciții, serii, repetări, pauze…'} /></label>
        <div className="flex gap-3"><button className={button} disabled={busy}>Salvează planul</button><button type="button" onClick={() => setEditorOpen(false)}>Renunță</button></div>
      </form>}
      {tab !== 'MESSAGES' && loaded && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => {
          const day = format(addDays(week, i), 'yyyy-MM-dd')
          const plans = entries.filter(e => e.date === day && e.kind === tab)
          const appointments = bookings.filter(b => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(b.startAt)) === day)
          return <section key={day} className="min-w-0 rounded-2xl border bg-white p-3">
            <h2 className="mb-3 text-sm font-semibold">{new Date(`${day}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })}</h2>
            {tab === 'BOOKINGS' ? appointments.length ? appointments.map(b => <article key={b.id} className="mb-2 rounded-xl bg-gray-50 p-2 text-sm"><strong>{new Date(b.startAt).toLocaleTimeString('ro-RO', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}</strong><p>{b.service.name}</p><p>{({ CONFIRMED: 'Confirmată', PENDING: 'În așteptare', CANCELLED: 'Anulată', COMPLETED: 'Finalizată', NO_SHOW: 'Neprezentare' } as Record<string,string>)[b.status]}</p></article>) : <p className="text-xs text-gray-400">Nicio programare</p> : plans.length ? plans.map(entry => <article key={entry.id} className={`mb-3 rounded-xl p-3 text-sm ${entry.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
              <p className="text-xs text-gray-500">{entry.time} {entry.completed && ' · Realizat ✓'}</p><h3 className="mt-1 font-semibold break-words">{entry.title}</h3><p className="mt-2 whitespace-pre-wrap break-words">{entry.details}</p>
              {entry.feedback && <p className="mt-2 whitespace-pre-wrap break-words text-gray-600">Observații: {entry.feedback}</p>}
              {owner ? <div className="mt-3 flex flex-wrap gap-2"><button className="underline" onClick={() => { setEditing(entry); setPlan({ kind: entry.kind, date: entry.date, time: entry.time, title: entry.title, details: entry.details }); setEditorOpen(true) }}>Editează</button>
                <button className="text-red-600 underline" disabled={busy} onClick={() => { if (confirm('Ștergi această intrare din plan?')) void action(async () => { await api(`/api/fitness/entries/${entry.id}?${query}`, 'DELETE', { version: entry.version }) }) }}>Șterge</button></div>
                : <button className="mt-3 underline" onClick={() => setProgress({ ...entry })}>Bifează / Observații</button>}
            </article>) : <p className="text-xs text-gray-400">Fără plan</p>}
          </section>
        })}
      </div>}
      {progress && !owner && <form className="rounded-2xl border bg-white p-4 space-y-3" onSubmit={e => { e.preventDefault(); void action(async () => { await api(`/api/fitness/entries/${progress.id}?${query}`, 'PATCH', { completed: progress.completed, feedback: progress.feedback, version: progress.version }); setProgress(null) }) }}>
        <h2 className="font-semibold">{progress.title}</h2>
        <label className="flex gap-2"><input type="checkbox" checked={progress.completed} onChange={e => setProgress({ ...progress, completed: e.target.checked })} />Am realizat această activitate</label>
        <label className="block">Observații pentru instructor<textarea className={field} rows={3} maxLength={2000} value={progress.feedback} onChange={e => setProgress({ ...progress, feedback: e.target.value })} /></label>
        <button className={button} disabled={busy}>Salvează progresul</button><button type="button" className="ml-3" onClick={() => setProgress(null)}>Renunță</button>
      </form>}
      {tab === 'MESSAGES' && <section className="rounded-2xl border bg-white p-4 space-y-4">
        {owner && <div className="rounded-xl bg-blue-50 p-3 text-sm"><button className={button} disabled={busy} onClick={() => action(async () => {
          const url = `https://meet.jit.si/FitEasy-${crypto.randomUUID()}`
          await api(`/api/fitness/messages?${query}`, 'POST', { text: `Apel video: ${url}` })
        })}>Trimite invitație apel video</button><p className="mt-2">Apelul se deschide în Jitsi, serviciu extern. Instructorul intră primul și se autentifică pentru a porni întâlnirea. Activează lobby-ul/parola înainte de a primi clientul. Nu se pornesc camera sau microfonul automat.</p></div>}
        {(hasMoreOlder ?? hasMore) && <button className="underline text-sm" disabled={busy} onClick={() => action(async () => {
          const first = older[0] || messages[0]; if (!first) return
          const data = await api(`/api/fitness/messages?${query}&before=${encodeURIComponent(first.createdAt)}`)
          setOlder(prev => [...data.messages, ...prev]); setHasMoreOlder(data.hasMore)
        })}>Încarcă mesaje mai vechi</button>}
        <div className="max-h-[55vh] overflow-y-auto space-y-3" aria-label="Conversație">
          {[...older, ...messages].filter((m, i, all) => all.findIndex(x => x.id === m.id) === i).map(m => {
            const videoUrl = /^Apel video: (https:\/\/meet\.jit\.si\/FitEasy-[a-f0-9-]+)$/.exec(m.text)?.[1]
            return <article key={m.id} className={`max-w-[90%] rounded-2xl p-3 text-sm ${m.sender === (owner ? 'INSTRUCTOR' : 'CLIENT') ? 'ml-auto bg-[#14142b] text-white' : 'bg-gray-100'}`}><p className="mb-1 text-xs opacity-70">{m.sender === 'INSTRUCTOR' ? 'Instructor' : 'Client'} · {new Date(m.createdAt).toLocaleString('ro-RO', { timeZone: timezone })}</p>
              {videoUrl ? <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline">Intră în apelul video · Jitsi ↗</a> : <p className="whitespace-pre-wrap break-words">{m.text}</p>}</article>
          })}
          {!messages.length && <p className="text-sm text-gray-500">Niciun mesaj încă.</p>}
        </div>
        <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void action(async () => { await api(`/api/fitness/messages?${query}`, 'POST', { text: draft }); setDraft('') }) }}>
          <label className="flex-1 text-sm">Mesaj<textarea className={field} required maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} rows={2} /></label><button className={button} disabled={busy || !draft.trim()}>Trimite</button>
        </form>
      </section>}
    </>}
  </div>
}
