'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Apple, ArrowRight, CalendarCheck, ClipboardList, Download, Dumbbell, Home, Sparkles, TrendingUp, UserRound, Video } from 'lucide-react'
import type { FitnessData, FitnessTaskData } from '@/lib/fitness-types'
import { fitnessDate } from '@/lib/fitness-validation'
import { FitnessDatePicker, FitnessDialog, FitnessField, FitnessTaskCard, fitnessIcons, fitnessLabels } from './widgets'
import { FitnessVideoCall } from './video-call'
import './fitness.css'

export default function FitnessClientWorkspace({ initial, name, initialDay }: { initial: FitnessData; name: string; initialDay: string }) {
  const [data, setData] = useState(initial)
  const [day, setDay] = useState(initialDay)
  const [tab, setTab] = useState<'home' | 'WORKOUT' | 'NUTRITION' | 'progress'>('home')
  const [memberId, setMemberId] = useState(initial.members[0]?.id || '')
  const [task, setTask] = useState<FitnessTaskData | null>(null)
  const [videoId, setVideoId] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const requestId = useRef(0)
  const mountedDay = useRef(day)
  const member = data.members.find(m => m.id === memberId)
  const tasks = data.tasks.filter(t => t.memberId === memberId && t.day === day)
  const done = tasks.filter(t => t.completed).length
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0
  const today = fitnessDate(new Date(), data.timezone)
  const plans = data.plans.filter(p => p.memberId === memberId && p.kind === tab)

  useEffect(() => { setReady(true) }, [])

  useEffect(() => {
    if (mountedDay.current === day) return
    mountedDay.current = day
    void refresh(day)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])
  useEffect(() => {
    const refreshOnFocus = () => { if (!document.hidden) void refresh(day) }
    window.addEventListener('focus', refreshOnFocus)
    const timer = window.setInterval(() => { if (!document.hidden && !task && !busy) void refresh(day) }, 30000)
    return () => { window.removeEventListener('focus', refreshOnFocus); window.clearInterval(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, task, busy])

  async function refresh(selectedDay = day) {
    const id = ++requestId.current
    setLoading(true)
    try {
      const response = await fetch(`/api/customer/fitness?day=${selectedDay}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Datele nu au putut fi actualizate.')
      if (id === requestId.current) {
        setData(result); setError('')
        if (!result.members.some((m: { id: string }) => m.id === memberId)) setMemberId(result.members[0]?.id || '')
      }
    } catch (error) { if (id === requestId.current) setError(error instanceof Error ? error.message : 'Conexiune întreruptă.') }
    finally { if (id === requestId.current) setLoading(false) }
  }

  async function updateTask(current: FitnessTaskData, completed: boolean, feedback = current.feedback) {
    setBusy(current.id); setError('')
    try {
      const response = await fetch('/api/customer/fitness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'task', id: current.id, completed, feedback, version: current.version }) })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 409) { setTask(null); await refresh() }
        throw new Error(result.error || 'Sarcina nu a putut fi salvată.')
      }
      setTask(null)
      await refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Nu s-a salvat. Verifică internetul și încearcă din nou.') }
    finally { setBusy('') }
  }

  return <div className="fitness-client-page" aria-busy={loading}>
    <div className="fitness-client-brand"><Link href="/fitness"><Image src="/logo-mark-square.png" width={30} height={30} alt="" />BookEasy <span className="text-[var(--brand-teal)]">Fitness</span></Link><button className="fitness-icon-button" aria-label="Instalează aplicația" onClick={() => window.dispatchEvent(new Event('bookeasy-install-request'))}><Download size={18} /></button></div>
    <header className="fitness-header"><div><p className="fitness-eyebrow"><Sparkles size={13} /> Fiecare pas contează</p><h1>Bună, {name.split(' ')[0] || member?.name.split(' ')[0] || 'bine ai venit'}!</h1><p className="fitness-subtitle">{member?.instructorName ? `Alături de ${member.instructorName}. ` : ''}{member?.goal || 'Pași mici, făcuți consecvent.'}</p></div></header>
    {data.members.length > 1 && <div className="fitness-filters"><select value={memberId} aria-label="Alege programul de coaching" onChange={e => setMemberId(e.target.value)}>{data.members.map(m => <option key={m.id} value={m.id}>{m.instructorName || 'Coaching'} · {m.goal.slice(0, 35) || m.name}</option>)}</select></div>}
    {error && !task && <p role="alert" className="fitness-error">{error}</p>}
    {tab === 'home' && <div className="fitness-client-hero"><div className="fitness-ring" style={{ '--progress': `${percent}%` } as React.CSSProperties}><strong>{percent}%</strong></div><div><h2>{day === today ? 'Progresul de azi' : 'Progresul zilei'}</h2><p>{done} din {tasks.length} sarcini finalizate</p><p>{percent === 100 && tasks.length ? 'Ai reușit! Continuă în ritmul tău.' : 'Fiecare obicei bun te aduce mai aproape.'}</p></div></div>}
    <div className="fitness-toolbar"><FitnessDatePicker day={day} onChange={setDay} today={today} /><button className="fitness-text-button" disabled={loading} onClick={() => void refresh()}>{loading ? 'Se încarcă…' : 'Actualizează'}</button></div>
    {!member && <section className="fitness-client-section fitness-empty"><Dumbbell size={32} /><strong>Programul tău începe cu o invitație.</strong><p>Cere instructorului linkul personal pentru a primi planuri și sarcini. Dacă aveai deja acces, contactează instructorul.</p><Link className="fitness-text-button" href="/cont">Contul meu <ArrowRight size={14} /></Link></section>}
    {member && <>
      {(tab === 'home' || tab === 'WORKOUT' || tab === 'NUTRITION') && <section className="fitness-client-section"><div className="fitness-client-section-heading"><CalendarCheck size={21} /><h2>{tab === 'home' ? 'Sarcinile zilei' : tab === 'WORKOUT' ? 'Antrenamente și obiceiuri' : 'Nutriția zilei'}</h2></div><div className="fitness-client-tasks">{tasks.filter(t => tab === 'home' || (tab === 'WORKOUT' ? t.kind !== 'NUTRITION' : t.kind === 'NUTRITION')).map(t => <FitnessTaskCard key={t.id} task={t} onOpen={() => setTask(t)} onToggle={() => { if (!busy) void updateTask(t, !t.completed) }} busy={!ready || Boolean(busy) || loading} />)}</div>{!tasks.some(t => tab === 'home' || (tab === 'WORKOUT' ? t.kind !== 'NUTRITION' : t.kind === 'NUTRITION')) && <div className="fitness-empty"><ClipboardList size={26} /><strong>Nicio sarcină programată.</strong><p>Planificarea instructorului apare aici. Poți vedea și celelalte zile.</p></div>}</section>}
      {tab === 'home' && <>{(['WORKOUT', 'NUTRITION'] as const).map(kind => { const Icon = fitnessIcons[kind]; const plan = data.plans.find(p => p.memberId === memberId && p.kind === kind); return <section className="fitness-client-section" key={kind}><div className="fitness-client-section-heading"><Icon size={21} /><h2>{kind === 'WORKOUT' ? 'Planul de antrenament' : 'Planul de nutriție'}</h2><button className="fitness-text-button ml-auto" onClick={() => setTab(kind)}>Vezi <ArrowRight size={14} /></button></div><p className="text-sm font-semibold">{plan?.title || 'Se pregătește împreună cu instructorul.'}</p>{plan && <div className="fitness-plan-excerpt">{plan.details}</div>}</section> })}</>}
      {(tab === 'WORKOUT' || tab === 'NUTRITION') && plans.map(plan => <section className="fitness-client-section" key={plan.id}><p className="fitness-eyebrow">{fitnessLabels[plan.kind]}</p><h2 className="font-extrabold text-lg mt-3">{plan.title}</h2><div className="fitness-detail-text">{plan.details}</div></section>)}
      {tab === 'progress' && <section className="fitness-client-section"><div className="fitness-client-section-heading"><TrendingUp size={21} /><h2>Progresul tău</h2></div><p className="fitness-subtitle">Evaluări și observații adăugate de instructor.</p><div className="fitness-progress-list">{data.progress.filter(p => p.memberId === memberId).map(p => <div key={p.id}><strong>{new Date(`${p.day}T12:00:00Z`).toLocaleDateString('ro-RO')}{p.weightKg !== null ? ` · ${p.weightKg} kg` : ''}</strong><p>{p.note}</p></div>)}</div>{!data.progress.some(p => p.memberId === memberId) && <div className="fitness-empty">Prima evaluare va apărea aici.</div>}</section>}
    </>}
    <nav className="fitness-client-bottom" aria-label="Navigare Fitness">{([{ id: 'home', label: 'Acasă', icon: Home }, { id: 'WORKOUT', label: 'Antrenamente', icon: Dumbbell }, { id: 'NUTRITION', label: 'Nutriție', icon: Apple }, { id: 'progress', label: 'Progres', icon: TrendingUp }] as const).map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Icon />{label}</button>)}<Link href="/cont"><UserRound />Cont</Link></nav>
    {task && <FitnessDialog title={task.title} onClose={() => { if (!busy) { setTask(null); setError('') } }}>{error && <p role="alert" className="fitness-error">{error}</p>}<p className="fitness-detail-label">{task.day} · {task.time} · {task.durationMin} min</p><div className="fitness-detail-text">{task.details || 'Urmează indicațiile instructorului tău.'}</div>{task.planId && <section className="fitness-client-section"><p className="fitness-eyebrow">Planul asociat</p><h3 className="font-semibold mt-2">{data.plans.find(p => p.id === task.planId)?.title}</h3><div className="fitness-detail-text">{data.plans.find(p => p.id === task.planId)?.details}</div></section>}<form method="post" className="fitness-form mt-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void updateTask(task, task.completed, String(f.get('feedback') || '')) }}><FitnessField label="Cum a fost? · feedback pentru instructor"><textarea name="feedback" maxLength={2000} defaultValue={task.feedback} placeholder="Spune-i instructorului cum te-ai simțit…" /></FitnessField><div className="fitness-form-footer"><button className="btn-secondary" disabled={Boolean(busy)}>Salvează feedback</button><button type="button" className="btn-primary" disabled={Boolean(busy)} onClick={() => { const form = document.activeElement?.closest('form'); const feedback = form ? String(new FormData(form).get('feedback') || '') : task.feedback; void updateTask(task, !task.completed, feedback) }}>{busy ? 'Se salvează…' : task.completed ? 'Marchează nefinalizat' : 'Am finalizat'}</button></div></form>{task.hasVideo && <button className="btn-primary w-full mt-4 inline-flex items-center justify-center gap-2" onClick={() => { setVideoId(task.id); setTask(null) }}><Video size={17} />Intră în apel cu instructorul</button>}</FitnessDialog>}
    {videoId && <FitnessVideoCall taskId={videoId} onClose={() => setVideoId('')} />}
  </div>
}
