'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Apple, ArrowUpRight, CalendarDays, CheckCheck, ClipboardList, Copy, Dumbbell, ExternalLink, Plus, Smartphone, TrendingUp, UserPlus, Users, Video } from 'lucide-react';
import type { FitnessData, FitnessMemberData, FitnessPlanData, FitnessTaskData } from '@/lib/fitness-types'
import { fitnessDate } from '@/lib/fitness-validation'
import { FitnessDatePicker, FitnessDialog, FitnessField, FitnessTaskCard, fitnessIcons, fitnessLabels } from './widgets'
import { FitnessVideoCall } from './video-call'
import './fitness.css'

type Editor = { type: 'member'; member?: FitnessMemberData } | { type: 'plan'; plan?: FitnessPlanData; kind?: 'WORKOUT' | 'NUTRITION' } | { type: 'task'; task?: FitnessTaskData; kind?: FitnessTaskData['kind'] } | { type: 'progress'; memberId: string } | { type: 'invite'; url: string } | { type: 'detail'; task: FitnessTaskData }

export default function CoachWorkspace({ initial, initialDay, initialMember = '' }: { initial: FitnessData; initialDay: string; initialMember?: string }) {
  const [data, setData] = useState(initial)
  const [day, setDay] = useState(initialDay)
  const [tab, setTab] = useState<'calendar' | 'clients' | 'plans'>(initialMember ? 'clients' : 'calendar')
  const [memberId, setMemberId] = useState(initialMember)

  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [videoId, setVideoId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestId = useRef(0)
  const mountedDay = useRef(initialDay)
  const today = fitnessDate(new Date(), data.timezone)
  const members = data.members.filter(m => (!memberId || m.id === memberId || m.customerId === memberId) && `${m.name} ${m.phone} ${m.email}`.toLocaleLowerCase('ro').includes(search.toLocaleLowerCase('ro')))
  const memberIds = new Set(members.map(m => m.id))
  const tasks = data.tasks.filter(t => memberIds.has(t.memberId) && t.day === day)
  const plans = data.plans.filter(p => memberIds.has(p.memberId))
  const completed = tasks.filter(t => t.completed).length
  const memberName = (id: string) => data.members.find(m => m.id === id)?.name || 'Client'

  useEffect(() => {
    if (mountedDay.current === day) return
    mountedDay.current = day
    void refresh(day)
  // The selected date is the only trigger; mutations refresh explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden && !busy && !editor) void refresh(day) }, 30000)
    return () => window.clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, busy, editor])

  async function refresh(selectedDay = day) {
    const id = ++requestId.current
    setLoading(true)
    try {
      const response = await fetch(`/api/business/fitness?day=${selectedDay}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Datele nu au putut fi încărcate.')
      if (id === requestId.current) { setData(result); setError('') }
    } catch (error) { if (id === requestId.current) setError(error instanceof Error ? error.message : 'Conexiune întreruptă.') }
    finally { if (id === requestId.current) setLoading(false) }
  }

  async function mutate(body: unknown, method = 'POST') {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/business/fitness', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Verifică datele introduse.')
      setEditor(result.inviteUrl ? { type: 'invite', url: result.inviteUrl } : null)
      setNotice(result.inviteUrl ? 'Invitația este valabilă 48 de ore și poate fi folosită o singură dată.' : 'Modificările au fost salvate.')
      await refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Conexiune întreruptă. Încearcă din nou.') }
    finally { setBusy(false) }
  }

  function openTask(kind: FitnessTaskData['kind']) {
    if (!data.members.some(m => m.active)) { setEditor({ type: 'member' }); return }
    setEditor({ type: 'task', kind })
  }

  const stats = [
    { icon: Users, value: data.members.filter(m => m.active).length, label: 'Clienți în coaching' },
    { icon: Dumbbell, value: tasks.filter(t => t.kind === 'WORKOUT').length, label: 'Antrenamente în această zi' },
    { icon: Apple, value: data.plans.filter(p => p.kind === 'NUTRITION').length, label: 'Planuri de nutriție' },
    { icon: CheckCheck, value: tasks.length ? `${Math.round(completed / tasks.length * 100)}%` : '—', label: 'Sarcini finalizate în această zi' },
  ]

  return <div className="fitness-workspace" aria-busy={loading}>
    <header className="fitness-header"><div><p className="fitness-eyebrow"><Dumbbell size={14} /> BookEasy · Fitness & personal training</p><h1>Mai aproape de fiecare obiectiv.</h1><p className="fitness-subtitle">Clienți, antrenamente și nutriție. Totul în ritmul tău.</p></div><div className="fitness-header-actions"><button className="btn-secondary" onClick={() => setEditor({ type: 'member' })}><UserPlus size={16} /> Adaugă client</button><button className="btn-primary" onClick={() => openTask('WORKOUT')}><Plus size={17} /> Planifică o sarcină</button></div></header>
    <div className="fitness-stats">{stats.map(({ icon: Icon, value, label }) => <div key={label} className="fitness-stat"><span className="fitness-stat-icon"><Icon size={21} /></span><div><strong>{value}</strong><p>{label}</p></div></div>)}</div>
    <div className="fitness-toolbar"><div className="fitness-tabs" role="tablist" aria-label="Modul Fitness">{([{ id: 'calendar', label: 'Calendare', icon: CalendarDays }, { id: 'clients', label: 'Clienți', icon: Users }, { id: 'plans', label: 'Planuri', icon: ClipboardList }] as const).map(({ id, label, icon: Icon }) => <button key={id} role="tab" id={`fitness-tab-${id}`} aria-controls="fitness-panel" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={15} />{label}</button>)}</div><FitnessDatePicker day={day} onChange={setDay} today={today} /></div>
    <div className="fitness-filters"><input type="search" aria-label="Caută client" placeholder="Caută un client…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filtrează după client" value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">Toți clienții</option>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}{m.active ? '' : ' · inactiv'}</option>)}</select><button className="fitness-text-button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Se încarcă…' : 'Actualizează'}</button></div>
    {error && !editor && <p className="fitness-error" role="alert">{error}</p>}{notice && <p className="fitness-notice" role="status">{notice}</p>}
    <section role="tabpanel" id="fitness-panel" aria-labelledby={`fitness-tab-${tab}`}>
      {tab === 'calendar' && <div className="fitness-calendar-grid">
        <section className="fitness-calendar-column"><div className="fitness-column-heading"><span><CalendarDays size={19} /></span><div><h2>Ședințe</h2><p>Antrenamente și evaluări</p></div><Link href="/dashboard/calendar" className="fitness-icon-button" aria-label="Deschide calendarul de ședințe"><ArrowUpRight size={17} /></Link></div><div className="fitness-column-body">{data.bookings?.filter(b => fitnessDate(new Date(b.startAt), data.timezone) === day && ((!memberId && !search) || members.some(m => m.customerId === b.customerId))).map(b => <Link key={b.id} href="/dashboard/calendar" className="fitness-task"><span className="fitness-task-content"><span className="fitness-task-symbol"><CalendarDays size={17} /></span><span><span className="fitness-task-meta">{new Date(b.startAt).toLocaleTimeString('ro-RO', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' })} – {new Date(b.endAt).toLocaleTimeString('ro-RO', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' })}</span><strong>{b.title}</strong></span></span></Link>)}{!data.bookings?.some(b => fitnessDate(new Date(b.startAt), data.timezone) === day && ((!memberId && !search) || members.some(m => m.customerId === b.customerId))) && <div className="fitness-empty"><CalendarDays size={29} /><strong>Loc pentru o nouă întâlnire</strong><p>Nicio ședință pentru selecția curentă.</p><Link className="fitness-text-button" href="/dashboard/calendar">Adaugă o ședință <ArrowUpRight size={14} /></Link></div>}</div></section>
        {(['WORKOUT', 'NUTRITION'] as const).map(kind => { const Icon = fitnessIcons[kind]; const entries = tasks.filter(t => kind === 'WORKOUT' ? t.kind === kind || t.kind === 'HABIT' : t.kind === kind); return <section key={kind} className="fitness-calendar-column"><div className="fitness-column-heading"><span><Icon size={19} /></span><div><h2>{kind === 'WORKOUT' ? 'Antrenamente' : 'Nutriție'}</h2><p>{kind === 'WORKOUT' ? 'Sesiuni, exerciții și obiceiuri' : 'Mese, check-in și urmărire'}</p></div><button className="fitness-icon-button" aria-label={`Adaugă: ${fitnessLabels[kind]}`} onClick={() => openTask(kind)}><Plus size={17} /></button></div><div className="fitness-column-body">{entries.map(t => <FitnessTaskCard key={t.id} task={t} name={memberName(t.memberId)} onOpen={() => setEditor({ type: 'detail', task: t })} />)}{!entries.length && <div className="fitness-empty"><Icon size={29} /><strong>{kind === 'WORKOUT' ? 'Construiește o rutină' : 'Un plan, pas cu pas'}</strong><p>{kind === 'WORKOUT' ? 'Planifică următorul antrenament al clientului.' : 'Adaugă mese sau o întâlnire de nutriție.'}</p><button className="fitness-text-button" onClick={() => openTask(kind)}><Plus size={14} />Adaugă în calendar</button></div>}</div></section> })}
      </div>}
      {tab === 'clients' && <>{!members.length && <div className="fitness-empty"><Users size={32} /><strong>Primul pas începe cu un client.</strong><p>Adaugă un client din baza BookEasy și invită-l în aplicație.</p><button className="btn-primary" onClick={() => setEditor({ type: 'member' })}>Adaugă client</button></div>}<div className="fitness-member-grid">{members.map(m => <article key={m.id} className="fitness-member-card"><div className="fitness-member-top"><span className="fitness-avatar">{m.name.split(' ').slice(0, 2).map(n => n[0]).join('')}</span><div><h2>{m.name}</h2><p>{m.instructorName || 'Coaching personal'}</p></div><span className={`fitness-status ${m.connected && m.active ? 'is-connected' : ''}`}>{!m.active ? 'Inactiv' : m.connected ? 'Conectat' : 'Neconectat'}</span></div><p className="fitness-goal">{m.goal || 'Adaugă un obiectiv pentru acest client.'}</p><div className="fitness-member-footer"><button className="fitness-text-button" onClick={() => setEditor({ type: 'member', member: m })}>Editează fișa</button><button className="fitness-text-button" onClick={() => setEditor({ type: 'progress', memberId: m.id })}><TrendingUp size={14} /> Progres</button>{!m.connected && m.active && <button disabled={busy} className="fitness-text-button" onClick={() => void mutate({ entity: 'invite', id: m.id })}><Smartphone size={14} />Invită în PWA</button>}<Link href={`/dashboard/clienti/${m.customerId}`} aria-label={`Date de contact: ${m.name}`} className="fitness-icon-button ml-auto"><ExternalLink size={14} /></Link></div></article>)}</div></>}
      {tab === 'plans' && <><div className="flex flex-wrap gap-2 mb-5"><button className="btn-secondary inline-flex items-center gap-2" onClick={() => setEditor({ type: 'plan', kind: 'WORKOUT' })}><Dumbbell size={16} /> Plan de antrenament</button><button className="btn-secondary inline-flex items-center gap-2" onClick={() => setEditor({ type: 'plan', kind: 'NUTRITION' })}><Apple size={16} /> Plan de nutriție</button></div><div className="fitness-plan-grid">{plans.map(p => { const Icon = fitnessIcons[p.kind]; return <article key={p.id} className="fitness-plan-card"><p className="fitness-eyebrow"><Icon size={15} />{fitnessLabels[p.kind]}</p><h2>{p.title}</h2><p>{memberName(p.memberId)}</p><div className="fitness-plan-excerpt">{p.details}</div><div className="fitness-member-footer"><button className="fitness-text-button" onClick={() => setEditor({ type: 'plan', plan: p })}>Vezi și editează</button><button className="fitness-text-button" onClick={() => { setMemberId(p.memberId); setEditor({ type: 'task', kind: p.kind }) }}><Plus size={14} />Planifică</button></div></article> })}</div>{!plans.length && <div className="fitness-empty"><ClipboardList size={30} /><strong>Planuri făcute pentru fiecare client.</strong><p>Scrie exercițiile, seriile și repetările sau mesele și cantitățile. Clientul le găsește în aplicație.</p></div>}</>}
    </section>
    <div className="fitness-banner"><Smartphone size={28} className="text-[var(--brand-teal-dark)] shrink-0" /><div><h2>Coaching-ul continuă și între sesiuni.</h2><p>Clienții își văd planurile, bifează sarcinile și intră în apel direct din aplicația BookEasy.</p></div><button className="fitness-text-button" onClick={() => setTab('clients')}>Invită un client <ArrowUpRight size={15} /></button></div>
    {editor && <FitnessDialog title={editor.type === 'member' ? editor.member ? 'Fișa clientului' : 'Adaugă client în coaching' : editor.type === 'plan' ? editor.plan ? 'Editează planul' : 'Plan personalizat' : editor.type === 'task' ? editor.task ? 'Editează sarcina' : 'Planifică o sarcină' : editor.type === 'progress' ? 'Progresul clientului' : editor.type === 'invite' ? 'Invită clientul în BookEasy' : editor.task.title} onClose={() => { if (!busy) { setEditor(null); setError('') } }}>
      {error && <p role="alert" className="fitness-error">{error}</p>}
      {editor.type === 'member' && <form method="post" className="fitness-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate({ entity: 'member', id: editor.member?.id, data: { customerId: f.get('customerId'), goal: f.get('goal'), coachNotes: f.get('coachNotes'), active: f.get('active') === 'on' } }) }}>
        <FitnessField label="Client din baza BookEasy"><select name="customerId" required defaultValue={editor.member?.customerId || ''} disabled={Boolean(editor.member)}>{editor.member && <option value={editor.member.customerId}>{editor.member.name}</option>}<option value="">Alege clientul</option>{data.customers?.filter(c => !data.members.some(m => m.customerId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name || c.phone}</option>)}</select>{editor.member && <input type="hidden" name="customerId" value={editor.member.customerId} />}</FitnessField>
        {!editor.member && <p className="fitness-detail-label">Nu este în listă? <Link className="underline" href="/dashboard/clienti">Creează clientul în BookEasy</Link>, apoi revino și actualizează lista.</p>}
        <FitnessField label="Obiectiv · vizibil clientului"><textarea name="goal" maxLength={1000} placeholder="De exemplu: dezvoltarea forței și consecvență, 3 antrenamente pe săptămână." defaultValue={editor.member?.goal} /></FitnessField>
        <FitnessField label="Notițe private · vizibile doar instructorului"><textarea name="coachNotes" maxLength={5000} placeholder="Preferințe, limitări discutate, observații pentru următoarea sesiune…" defaultValue={editor.member?.coachNotes} /></FitnessField>
        <label className="fitness-checkbox-field"><input type="checkbox" name="active" defaultChecked={editor.member?.active ?? true} />Client activ · are acces la aplicație</label>
        {editor.member?.connected && <button type="button" className="fitness-text-button text-red-700" disabled={busy} onClick={() => { if (window.confirm('Revoci accesul acestui cont de client la planuri și sarcini?')) void mutate({ entity: 'disconnect', id: editor.member!.id }) }}>Revocă accesul aplicației client</button>}
        <div className="fitness-form-footer"><button className="btn-primary" disabled={busy}>{busy ? 'Se salvează…' : 'Salvează fișa'}</button></div>
      </form>}
      {editor.type === 'plan' && <form method="post" className="fitness-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate({ entity: 'plan', id: editor.plan?.id, data: { memberId: f.get('memberId'), kind: f.get('kind'), title: f.get('title'), details: f.get('details') } }) }}>
        <FitnessField label="Client"><select name="memberId" required defaultValue={editor.plan?.memberId || memberId || ''} disabled={Boolean(editor.plan)}><option value="">Alege clientul</option>{data.members.filter(m => m.active || m.id === editor.plan?.memberId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>{editor.plan && <input type="hidden" name="memberId" value={editor.plan.memberId} />}</FitnessField>
        <FitnessField label="Tip de plan"><select name="kind" defaultValue={editor.plan?.kind || editor.kind || 'WORKOUT'} disabled={Boolean(editor.plan)}><option value="WORKOUT">Antrenament</option><option value="NUTRITION">Nutriție</option></select>{editor.plan && <input type="hidden" name="kind" value={editor.plan.kind} />}</FitnessField>
        <FitnessField label="Numele planului"><input name="title" required minLength={2} maxLength={150} placeholder="De exemplu: Forță · săptămâna 1" defaultValue={editor.plan?.title} /></FitnessField>
        <FitnessField label="Conținutul planului · vizibil în aplicația clientului"><textarea name="details" required maxLength={15000} rows={12} placeholder={'Antrenament: exercițiu · serii × repetări · pauză\nNutriție: masă · alimente · cantități\n\nAdaugă instrucțiuni clare, adaptate clientului.'} defaultValue={editor.plan?.details} /></FitnessField>
        <div className="fitness-form-footer">{editor.plan && <button type="button" className="fitness-text-button text-red-700 mr-auto" disabled={busy} onClick={() => { if (window.confirm('Ștergi planul? Sarcinile programate se păstrează.')) void mutate({ entity: 'plan', id: editor.plan!.id }, 'DELETE') }}>Șterge planul</button>}<button className="btn-primary" disabled={busy}>{busy ? 'Se salvează…' : 'Salvează planul'}</button></div>
      </form>}
      {editor.type === 'task' && <TaskForm data={data} memberId={memberId} day={day} editor={editor} busy={busy} onSave={mutate} />}
      {editor.type === 'detail' && <><p className="fitness-detail-label">{memberName(editor.task.memberId)} · {editor.task.day} · {editor.task.time} · {editor.task.durationMin} min · {editor.task.completed ? 'Finalizată' : 'De făcut'}</p><div className="fitness-detail-text">{editor.task.details || 'Fără instrucțiuni suplimentare.'}</div>{editor.task.planId && <div className="fitness-notice">Plan: {data.plans.find(p => p.id === editor.task.planId)?.title}</div>}{editor.task.feedback && <div className="fitness-notice"><strong>Feedback client</strong><p className="whitespace-pre-wrap mt-1">{editor.task.feedback}</p></div>}<div className="fitness-form-footer"><button className="btn-secondary" onClick={() => setEditor({ type: 'task', task: editor.task })}>Editează</button>{editor.task.hasVideo && <button className="btn-primary inline-flex items-center gap-2" onClick={() => { setVideoId(editor.task.id); setEditor(null) }}><Video size={16} />Intră în apel</button>}</div></>}
      {editor.type === 'invite' && <><p className="fitness-detail-text">Trimite acest link clientului tău. Își creează sau folosește contul personal BookEasy, apoi confirmă conectarea cu instructorul.</p><FitnessField label="Link personal · valabil 48 de ore"><input readOnly value={editor.url} onFocus={e => e.target.select()} /></FitnessField><button className="btn-primary mt-4 inline-flex items-center gap-2" onClick={() => { void navigator.clipboard.writeText(editor.url).then(() => setNotice('Link copiat.')).catch(() => setError('Selectează și copiază manual linkul.')) }}><Copy size={16} />Copiază invitația</button></>}
      {editor.type === 'progress' && <><p className="fitness-detail-label">{memberName(editor.memberId)} · Istoricul este vizibil și clientului.</p><form method="post" className="fitness-form mt-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate({ entity: 'progress', data: { memberId: editor.memberId, day: f.get('day'), weightKg: f.get('weight') ? Number(f.get('weight')) : null, note: f.get('note') } }) }}><div className="fitness-form-row"><FitnessField label="Data"><input name="day" type="date" defaultValue={day} required /></FitnessField><FitnessField label="Greutate (kg) · opțional"><input name="weight" type="number" min={20} max={500} step="0.1" /></FitnessField></div><FitnessField label="Observații și progres"><textarea name="note" maxLength={2000} placeholder="Cum evoluează forța, energia și consecvența?" /></FitnessField><button className="btn-primary" disabled={busy}>Salvează evaluarea</button></form><div className="fitness-progress-list">{data.progress.filter(p => p.memberId === editor.memberId).map(p => <div key={p.id}><strong>{p.day}{p.weightKg !== null ? ` · ${p.weightKg} kg` : ''}</strong><p>{p.note}</p></div>)}</div></>}
    </FitnessDialog>}
    {videoId && <FitnessVideoCall taskId={videoId} onClose={() => setVideoId('')} />}
  </div>
}

function TaskForm({ data, memberId, day, editor, busy, onSave }: { data: FitnessData; memberId: string; day: string; editor: Extract<Editor, { type: 'task' }>; busy: boolean; onSave: (body: unknown, method?: string) => Promise<void> }) {
  const [selectedMember, setSelectedMember] = useState(editor.task?.memberId || (data.members.find(m => m.id === memberId || m.customerId === memberId)?.id ?? ''))
  const [kind, setKind] = useState(editor.task?.kind || editor.kind || 'WORKOUT')
  return <form method="post" className="fitness-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void onSave({ entity: 'task', id: editor.task?.id, version: editor.task?.version, repeat: Number(f.get('repeat') || 1), intervalDays: Number(f.get('intervalDays') || 7), data: { memberId: selectedMember, kind, planId: f.get('planId') || null, title: f.get('title'), details: f.get('details'), day: f.get('day'), time: f.get('time'), durationMin: Number(f.get('durationMin')), video: f.get('video') === 'on' } }) }}>
    <FitnessField label="Client"><select required value={selectedMember} disabled={Boolean(editor.task)} onChange={e => setSelectedMember(e.target.value)}><option value="">Alege clientul</option>{data.members.filter(m => m.active || m.id === editor.task?.memberId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FitnessField>
    <FitnessField label="Tip de sarcină"><select value={kind} onChange={e => setKind(e.target.value as FitnessTaskData['kind'])}><option value="WORKOUT">Antrenament</option><option value="NUTRITION">Nutriție / masă / check-in</option><option value="HABIT">Obicei · apă, pași, recuperare</option></select></FitnessField>
    <FitnessField label="Plan asociat · opțional"><select name="planId" key={`${selectedMember}-${kind}`} defaultValue={editor.task?.planId || ''}><option value="">Fără plan asociat</option>{data.plans.filter(p => p.memberId === selectedMember && p.kind === kind).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></FitnessField>
    <FitnessField label="Titlul sarcinii"><input name="title" required minLength={2} maxLength={150} defaultValue={editor.task?.title} placeholder={kind === 'WORKOUT' ? 'Spate & biceps' : kind === 'NUTRITION' ? 'Prânz · conform planului' : 'Hidratare · 2 L apă'} /></FitnessField>
    <div className="fitness-form-row"><FitnessField label="Data"><input type="date" name="day" required defaultValue={editor.task?.day || day} /></FitnessField><FitnessField label="Ora locală a afacerii"><input type="time" name="time" required defaultValue={editor.task?.time || '09:00'} /></FitnessField></div>
    <FitnessField label="Durata (minute)"><input type="number" name="durationMin" min={5} max={240} required defaultValue={editor.task?.durationMin || (kind === 'NUTRITION' ? 30 : 45)} /></FitnessField>
    {!editor.task && <div className="fitness-form-row"><FitnessField label="Număr de apariții"><input type="number" name="repeat" min={1} max={28} defaultValue={1} required /></FitnessField><FitnessField label="Repetare"><select name="intervalDays" defaultValue="7"><option value="7">Săptămânal</option><option value="1">Zilnic</option></select></FitnessField></div>}
    <FitnessField label="Instrucțiuni pentru client"><textarea name="details" maxLength={5000} defaultValue={editor.task?.details} placeholder="Ce are de făcut clientul, pas cu pas…" /></FitnessField>
    <label className="fitness-checkbox-field"><input name="video" type="checkbox" defaultChecked={editor.task?.hasVideo} />Adaugă apel video Jitsi</label>
    <div className="fitness-form-footer">{editor.task && <button type="button" className="fitness-text-button text-red-700 mr-auto" disabled={busy} onClick={() => { if (window.confirm('Ștergi această sarcină din calendar și din aplicația clientului?')) void onSave({ entity: 'task', id: editor.task!.id }, 'DELETE') }}>Șterge sarcina</button>}<button className="btn-primary" disabled={busy}>{busy ? 'Se salvează…' : 'Salvează în calendar'}</button></div>
  </form>
}
