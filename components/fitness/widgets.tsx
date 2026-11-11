'use client'

import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from 'react'
import { Apple, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, X } from 'lucide-react'
import { moveFitnessDay } from '@/lib/fitness-validation'
import type { FitnessTaskData } from '@/lib/fitness-types'

export const fitnessLabels = { WORKOUT: 'Antrenament', NUTRITION: 'Nutriție', HABIT: 'Obicei' }
export const fitnessIcons = { WORKOUT: Dumbbell, NUTRITION: Apple, HABIT: HeartPulse }

export function FitnessDialog({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal(); const dialog = ref.current; return () => { dialog?.close() } }, [])
  return <dialog ref={ref} className={`fitness-dialog ${wide ? 'fitness-dialog-wide' : ''}`} aria-labelledby="fitness-dialog-title" onCancel={onClose} onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }}>
    <div className="fitness-dialog-heading"><h2 id="fitness-dialog-title">{title}</h2><button type="button" className="fitness-icon-button" aria-label="Închide" onClick={onClose}><X size={20} /></button></div>{children}
  </dialog>
}

export function FitnessField({ label, children }: { label: string; children: React.ReactNode }) {
  const labelId = useId()
  return <label className="fitness-field"><span id={labelId}>{label}</span>{Children.map(children, child => isValidElement(child) && typeof child.type === 'string' && ['input', 'select', 'textarea'].includes(child.type) ? cloneElement(child as React.ReactElement<{ 'aria-labelledby'?: string }>, { 'aria-labelledby': labelId }) : child)}</label>
}

export function FitnessDatePicker({ day, onChange, today }: { day: string; onChange: (day: string) => void; today: string }) {
  return <div className="fitness-date-picker"><button className="fitness-icon-button" aria-label="Ziua anterioară" onClick={() => onChange(moveFitnessDay(day, -1))}><ChevronLeft size={18} /></button><label><CalendarDays size={16} /><span className="sr-only">Alege ziua</span><input type="date" value={day} onChange={e => { if (e.target.value) onChange(e.target.value) }} /></label><button className="fitness-icon-button" aria-label="Ziua următoare" onClick={() => onChange(moveFitnessDay(day, 1))}><ChevronRight size={18} /></button><button className="fitness-text-button" onClick={() => onChange(today)}>Astăzi</button></div>
}

export function FitnessTaskCard({ task, name, onOpen, onToggle, busy }: { task: FitnessTaskData; name?: string; onOpen: () => void; onToggle?: () => void; busy?: boolean }) {
  const Icon = fitnessIcons[task.kind]
  return <div className={`fitness-task fitness-tone-${task.kind.toLowerCase()} ${task.completed ? 'is-completed' : ''}`}>
    {onToggle && <button type="button" className="fitness-check" aria-label={`${task.completed ? 'Marchează nefinalizat' : 'Finalizează'}: ${task.title}`} aria-pressed={task.completed} disabled={busy} onClick={onToggle}>{task.completed && <Check size={19} />}</button>}
    <button className="fitness-task-content" onClick={onOpen}><span className="fitness-task-symbol"><Icon size={19} /></span><span className="min-w-0"><span className="fitness-task-meta">{task.time} · {task.durationMin} min{name ? ` · ${name}` : ''}</span><strong>{task.title}</strong>{task.details && <span className="fitness-task-excerpt">{task.details}</span>}</span>{task.completed && !onToggle && <Check className="shrink-0" size={16} />}{task.hasVideo && <span className="fitness-video-label">Video</span>}</button>
  </div>
}
