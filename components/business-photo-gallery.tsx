'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useId, useRef, useState, type PointerEvent } from 'react'

type Point = { x: number; y: number }
type View = Point & { zoom: number }
const initialView: View = { x: 0, y: 0, zoom: 1 }
const maxZoom = 4

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function updateView(view: View, zoom: number, bounds: DOMRect, from?: Point, to?: Point): View {
  const nextZoom = clamp(zoom, 1, maxZoom)
  if (nextZoom === 1) return initialView
  const ratio = nextZoom / view.zoom
  const targetX = (from && to) ? to.x - from.x + (from.x - bounds.left - bounds.width / 2) * (1 - ratio) : 0
  const targetY = (from && to) ? to.y - from.y + (from.y - bounds.top - bounds.height / 2) * (1 - ratio) : 0
  const limitX = bounds.width * (nextZoom - 1) / 2
  const limitY = bounds.height * (nextZoom - 1) / 2
  return {
    zoom: nextZoom,
    x: clamp(view.x * ratio + targetX, -limitX, limitX),
    y: clamp(view.y * ratio + targetY, -limitY, limitY),
  }
}

const controls = 'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2'

export function BusinessPhotoGallery({ photos, businessName }: { photos: { id: string; url: string }[]; businessName: string }) {
  const labelId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const [selected, setSelected] = useState<number | null>(null)
  const [view, setView] = useState<View>(initialView)
  const photo = selected === null ? null : photos[selected]

  function show(index: number) {
    pointers.current.clear()
    setView(initialView)
    setSelected(index)
  }

  function step(direction: number) {
    if (selected !== null) show((selected + direction + photos.length) % photos.length)
  }

  function zoomBy(amount: number) {
    const bounds = stage.current?.getBoundingClientRect()
    if (bounds) setView((current) => updateView(current, current.zoom + amount, bounds))
  }

  function rememberPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || pointers.current.size >= 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const point = { x: event.clientX, y: event.clientY }
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1]
    pointers.current.set(event.pointerId, point)
    const bounds = event.currentTarget.getBoundingClientRect()

    if (other) {
      const distance = Math.hypot(previous.x - other.x, previous.y - other.y)
      if (distance < 2) return
      const ratio = Math.hypot(point.x - other.x, point.y - other.y) / distance
      const from = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 }
      const to = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }
      setView((current) => updateView(current, current.zoom * ratio, bounds, from, to))
      return
    }
    setView((current) => current.zoom === 1 ? current : updateView(current, current.zoom, bounds, previous, point))
  }

  function forgetPointer(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Mărește fotografia ${index + 1}`}
            onClick={() => { show(index); dialog.current?.showModal() }}
            className={`group relative cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal-dark)] ${index === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'}`}
          >
            <Image src={item.url} unoptimized={item.url.startsWith('/api/storage/public/')} alt={`${businessName} – fotografie ${index + 1}`} fill sizes={index === 0 ? '(max-width: 640px) 95vw, 520px' : '(max-width: 640px) 48vw, 260px'} className="object-cover motion-safe:transition motion-safe:group-hover:scale-[1.03]" quality={90} />
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/50 p-1.5 text-white" aria-hidden="true"><ZoomIn size={15} /></span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={labelId}
        onClose={() => { pointers.current.clear(); setSelected(null) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') step(-1)
          if (event.key === 'ArrowRight') step(1)
          if (event.key === '+' || event.key === '=') zoomBy(0.5)
          if (event.key === '-') zoomBy(-0.5)
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-[#121d20] text-white backdrop:bg-black/80"
      >
        {photo && (
          <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex min-h-14 items-center justify-between gap-2 px-3 sm:px-5">
              <h3 id={labelId} className="min-w-0 truncate text-sm font-semibold">Galerie · {businessName}</h3>
              <button type="button" className={controls} onClick={() => dialog.current?.close()} aria-label="Închide galeria" autoFocus><X size={21} /></button>
            </div>
            <div
              ref={stage}
              className={`relative flex-1 touch-none overflow-hidden ${view.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
              onPointerDown={rememberPointer}
              onPointerMove={movePointer}
              onPointerUp={forgetPointer}
              onPointerCancel={forgetPointer}
              onLostPointerCapture={forgetPointer}
              onDoubleClick={() => zoomBy(view.zoom > 1 ? 1 - view.zoom : 1)}
            >
              <Image key={photo.id} src={photo.url} unoptimized={photo.url.startsWith('/api/storage/public/')} alt={`${businessName} – fotografie ${(selected ?? 0) + 1}`} fill sizes="100vw" draggable={false} className="pointer-events-none select-none object-contain" quality={95} style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})` }} />
            </div>
            <div className="flex min-h-16 flex-wrap items-center justify-center gap-2 px-2 py-2 sm:gap-3">
              {photos.length > 1 && <button type="button" className={controls} onClick={() => step(-1)} aria-label="Fotografia anterioară"><ChevronLeft size={22} /></button>}
              <button type="button" className={controls} onClick={() => zoomBy(-0.5)} disabled={view.zoom <= 1} aria-label="Micșorează fotografia"><ZoomOut size={19} /></button>
              <span className="min-w-12 text-center text-xs tabular-nums text-white/75" aria-live="polite">{(selected ?? 0) + 1} / {photos.length}</span>
              <button type="button" className={controls} onClick={() => zoomBy(0.5)} disabled={view.zoom >= maxZoom} aria-label="Mărește fotografia"><ZoomIn size={19} /></button>
              {photos.length > 1 && <button type="button" className={controls} onClick={() => step(1)} aria-label="Fotografia următoare"><ChevronRight size={22} /></button>}
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
