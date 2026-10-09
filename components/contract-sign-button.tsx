'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'

export function ContractSignButton({ type, documentHash, initialName, providerBusinessId, contractId }: {
  type?: 'SERVICES' | 'DPA'
  documentHash?: string
  initialName: string
  providerBusinessId?: string
  contractId?: string
}) {
  const router = useRouter()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [confirmed, setConfirmed] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const provider = Boolean(providerBusinessId && contractId)

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const element = canvas.current!
    const rect = element.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * element.width / rect.width, y: (event.clientY - rect.top) * element.height / rect.height }
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const element = canvas.current!
    element.setPointerCapture(event.pointerId)
    const ctx = element.getContext('2d')!
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    drawing.current = true
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    event.preventDefault()
    const ctx = canvas.current!.getContext('2d')!
    const { x, y } = point(event)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1d3440'
    ctx.lineTo(x, y)
    ctx.stroke()
    setDrawn(true)
  }

  function clear() {
    const element = canvas.current
    element?.getContext('2d')?.clearRect(0, 0, element.width, element.height)
    setDrawn(false)
  }

  function openDialog() {
    setName(initialName)
    setConfirmed(false)
    setDrawn(false)
    setError('')
    setOpen(true)
  }

  async function sign() {
    if (!canvas.current || !drawn || !confirmed || name.trim().length < 3) return
    setSaving(true)
    setError('')
    try {
      const url = provider
        ? `/api/superadmin/businesses/${providerBusinessId}/contracts/${contractId}/sign`
        : '/api/business/contracts'
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, documentHash, signerName: name.trim(), signature: canvas.current.toDataURL('image/png'), confirmed }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Semnarea a eșuat.')
      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Semnarea a eșuat.')
    } finally { setSaving(false) }
  }

  return <>
    <button type="button" onClick={openDialog} className="btn-primary px-4 py-2 text-sm">{provider ? 'Contrasemnează' : 'Citește și semnează'}</button>
    {open && <div role="dialog" aria-modal="true" aria-label="Semnează documentul" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3">
      <div className="max-h-[95dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">{provider ? 'Contrasemnează documentul' : 'Semnează documentul'}</h2>
        <p className="mt-2 text-sm text-gray-600">Citește documentul integral înainte de semnare. Desenul de mai jos este păstrat împreună cu documentul și datele acceptării ca semnătură electronică simplă.</p>
        <label className="mt-4 block text-sm font-medium">Numele semnatarului
          <input className="input-field mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} readOnly maxLength={120} autoComplete="name" />
        </label>
        {!provider && <p className="mt-1 text-xs text-gray-500">Pentru schimbarea numelui, actualizează întâi reprezentantul din Setări.</p>}
        <p className="mt-4 text-sm font-medium">Semnează cu degetul sau mouse-ul</p>
        <canvas ref={canvas} width={600} height={220} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }} className="mt-1 h-[180px] w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-white" aria-label="Suprafață pentru desenarea semnăturii" />
        <button type="button" onClick={clear} className="mt-2 text-sm underline">Șterge și redesenează</button>
        <label className="mt-5 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />Confirm că am citit documentul și că semnez în numele părții indicate, având dreptul să o reprezint.</label>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-secondary px-4 py-2 text-sm">Renunță</button>
          <button type="button" onClick={sign} disabled={saving || !drawn || !confirmed || name.trim().length < 3} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Se salvează...' : 'Confirmă semnătura'}</button>
        </div>
      </div>
    </div>}
  </>
}
