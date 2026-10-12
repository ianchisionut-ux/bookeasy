'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STATUS = {
  HEALTHY: { label: 'Sănătos', color: '#f3efe2' },
  WATCH: { label: 'De urmărit', color: '#facc15' },
  CARIES: { label: 'Carie', color: '#dc2626' },
  FILLED: { label: 'Obturație', color: '#2563eb' },
  CROWN: { label: 'Coroană', color: '#a855f7' },
  ROOT_CANAL: { label: 'Tratament endodontic', color: '#f97316' },
  IMPLANT: { label: 'Implant', color: '#64748b' },
  MISSING: { label: 'Extras / lipsă', color: '#111827' },
} as const

type ToothStatus = keyof typeof STATUS
type HistoryItem = { at: string; status: ToothStatus; treatment: string; note: string }
type ToothEntry = {
  status: ToothStatus
  treatment: string
  note: string
  treatmentDate: string
  updatedAt: string
  history: HistoryItem[]
}
type DentalChartData = {
  version: 1
  teeth: Record<string, ToothEntry>
  generalNotes: string
  updatedAt: string
}

const UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']
const LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']

function emptyEntry(): ToothEntry {
  return { status: 'HEALTHY', treatment: '', note: '', treatmentDate: '', updatedAt: new Date().toISOString(), history: [] }
}

function normalizeChart(initial: unknown): DentalChartData {
  if (initial && typeof initial === 'object' && (initial as any).version === 1 && (initial as any).teeth) {
    return initial as DentalChartData
  }
  return { version: 1, teeth: {}, generalNotes: '', updatedAt: new Date().toISOString() }
}

function findTooth(object: THREE.Object3D | null): string | null {
  let current = object
  while (current) {
    const match = /^Tooth_([1-4][1-8])$/.exec(current.name)
    if (match) return match[1]
    current = current.parent
  }
  return null
}

function DentalModel({ chart, selected, onSelect }: { chart: DentalChartData; selected: string; onSelect: (tooth: string) => void }) {
  const gltf = useGLTF('/models/bookeasy-dental-chart.glb')
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => material.clone())
          : object.material.clone()
      }
    })
    return clone
  }, [gltf.scene])

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      if (object.name.startsWith('Gingiva_')) {
        return
      }
      const tooth = findTooth(object)
      if (!tooth) return
      const status = chart.teeth[tooth]?.status ?? 'HEALTHY'
      const crown = object.name.startsWith('Tooth_')
      object.visible = status !== 'MISSING'
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue
        if (crown) material.color.set(STATUS[status].color)
        material.emissive.set(crown && tooth === selected ? '#0e9aa7' : '#000000')
        material.emissiveIntensity = crown && tooth === selected ? 0.22 : 0
      }
    })
  }, [chart, model, selected])

  function handlePointer(event: ThreeEvent<PointerEvent>) {
    const tooth = findTooth(event.object)
    if (!tooth) return
    event.stopPropagation()
    onSelect(tooth)
  }

  return <primitive object={model} onPointerDown={handlePointer} />
}

function ToothRow({ label, teeth, chart, selected, onSelect }: { label: string; teeth: string[]; chart: DentalChartData; selected: string; onSelect: (tooth: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-16">
        {teeth.map((tooth) => {
          const status = chart.teeth[tooth]?.status ?? 'HEALTHY'
          return (
            <button
              key={tooth}
              type="button"
              onClick={() => onSelect(tooth)}
              title={`${tooth} · ${STATUS[status].label}`}
              className={`rounded-lg border px-1 py-2 text-xs font-semibold transition ${selected === tooth ? 'ring-2 ring-[var(--accent)] ring-offset-1' : ''}`}
              style={{ borderColor: STATUS[status].color, background: `${STATUS[status].color}22` }}
            >
              {tooth}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DentalChart({ customerId, patientName, initialChart }: { customerId: string; patientName: string; initialChart: unknown }) {
  const [chart, setChart] = useState(() => normalizeChart(initialChart))
  const [selected, setSelected] = useState('11')
  const [draft, setDraft] = useState<ToothEntry>(() => chart.teeth['11'] ?? emptyEntry())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => setDraft(chart.teeth[selected] ?? emptyEntry()), [chart.teeth, selected])

  function selectTooth(tooth: string) {
    setSelected(tooth)
    setMessage('')
  }

  function applyTooth(forcedStatus?: ToothStatus) {
    const now = new Date().toISOString()
    const next = { ...draft, status: forcedStatus ?? draft.status, updatedAt: now }
    const previous = chart.teeth[selected]
    const changed = !previous || previous.status !== next.status || previous.treatment !== next.treatment || previous.note !== next.note
    if (changed) next.history = [...(previous?.history ?? []), { at: now, status: next.status, treatment: next.treatment, note: next.note }].slice(-100)
    setChart((current) => ({ ...current, teeth: { ...current.teeth, [selected]: next }, updatedAt: now }))
    setDraft(next)
    setDirty(true)
    setMessage(`Dintele ${selected} a fost actualizat local. Salvează odontograma.`)
  }

  function resetTooth() {
    const now = new Date().toISOString()
    setChart((current) => {
      const teeth = { ...current.teeth }
      delete teeth[selected]
      return { ...current, teeth, updatedAt: now }
    })
    setDraft(emptyEntry())
    setDirty(true)
    setMessage(`Dintele ${selected} a fost resetat ca sănătos.`)
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const payload = { ...chart, updatedAt: new Date().toISOString() }
      const response = await fetch(`/api/business/patients/${customerId}/dental-chart`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Odontograma nu a putut fi salvată.')
      setChart(payload)
      setDirty(false)
      setMessage('✓ Odontograma a fost salvată în fișa pacientului.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A apărut o eroare la salvare.')
    } finally {
      setSaving(false)
    }
  }

  const current = chart.teeth[selected] ?? emptyEntry()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Odontogramă 3D · {patientName}</h2>
          <p className="mt-1 text-sm text-gray-500">Selectează un dinte din model sau după codul FDI. Rotește cu degetul/mouse-ul și apropie prin zoom.</p>
        </div>
        <Button onClick={save} disabled={saving || !dirty}>{saving ? 'Se salvează…' : dirty ? 'Salvează odontograma' : 'Odontogramă salvată'}</Button>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="h-[420px] bg-gradient-to-b from-slate-900 to-slate-800 sm:h-[560px]">
              <Canvas camera={{ position: [0, -11.5, 1.2], fov: 34 }} dpr={[1, 1.6]} gl={{ antialias: true }}>
                <color attach="background" args={['#172126']} />
                <ambientLight intensity={1.45} />
                <directionalLight position={[-5, -5, 8]} intensity={2.2} />
                <directionalLight position={[6, 1, 4]} intensity={1.3} />
                <Suspense fallback={<Html center><span className="rounded-full bg-white/90 px-3 py-1 text-sm text-gray-700">Se încarcă modelul…</span></Html>}>
                  <DentalModel chart={chart} selected={selected} onSelect={selectTooth} />
                </Suspense>
                <OrbitControls target={[0, -0.25, 0]} enablePan={false} minDistance={6.5} maxDistance={15} minPolarAngle={0.35} maxPolarAngle={Math.PI - 0.35} />
              </Canvas>
            </div>
            <div className="grid gap-3 border-t p-4">
              <ToothRow label="Arcadă superioară" teeth={UPPER} chart={chart} selected={selected} onSelect={selectTooth} />
              <ToothRow label="Arcadă inferioară" teeth={LOWER} chart={chart} selected={selected} onSelect={selectTooth} />
            </div>
          </Card>

          <Card>
            <label className="text-sm font-medium" htmlFor="dental-general-notes">Observații generale odontogramă</label>
            <textarea
              id="dental-general-notes"
              value={chart.generalNotes}
              onChange={(event) => { setChart((currentChart) => ({ ...currentChart, generalNotes: event.target.value })); setDirty(true) }}
              rows={3}
              maxLength={5000}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Ocluzie, plan general de tratament, observații parodontale…"
            />
          </Card>
        </div>

        <Card className="xl:sticky xl:top-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Dinte selectat</p>
              <h3 className="text-2xl font-semibold">FDI {selected}</h3>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${STATUS[current.status].color}22`, color: current.status === 'HEALTHY' ? '#46515a' : STATUS[current.status].color }}>
              {STATUS[current.status].label}
            </span>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium">Status
              <select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as ToothStatus }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2">
                {Object.entries(STATUS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Tratament / lucrare
              <input value={draft.treatment} onChange={(event) => setDraft((value) => ({ ...value, treatment: event.target.value }))} maxLength={500} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="ex: obturație compozit, coroană zirconiu" />
            </label>
            <label className="block text-sm font-medium">Data tratamentului
              <input type="date" value={draft.treatmentDate} onChange={(event) => setDraft((value) => ({ ...value, treatmentDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium">Notițe clinice
              <textarea value={draft.note} onChange={(event) => setDraft((value) => ({ ...value, note: event.target.value }))} maxLength={2000} rows={4} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Suprafețe afectate, simptomatologie, recomandări…" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => applyTooth()}>Aplică la dinte</Button>
              {current.status !== 'MISSING' ? <Button variant="secondary" onClick={() => applyTooth('MISSING')}>Marchează extras/lipsă</Button> : <Button variant="secondary" onClick={resetTooth}>Readaugă sănătos</Button>}
              {current.status !== 'HEALTHY' && current.status !== 'MISSING' && <Button variant="secondary" onClick={resetTooth}>Resetează</Button>}
            </div>
          </div>

          {message && <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${message.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{message}</p>}

          {current.history.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-semibold">Istoric dinte</h4>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {[...current.history].reverse().slice(0, 8).map((item, index) => (
                  <div key={`${item.at}-${index}`} className="rounded-xl bg-gray-50 p-3 text-xs">
                    <div className="flex justify-between gap-2"><strong>{STATUS[item.status].label}</strong><span className="text-gray-500">{new Date(item.at).toLocaleString('ro-RO')}</span></div>
                    {item.treatment && <p className="mt-1">{item.treatment}</p>}
                    {item.note && <p className="mt-1 text-gray-600">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
        {Object.entries(STATUS).map(([value, option]) => <span key={value} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border" style={{ background: option.color }} />{option.label}</span>)}
      </div>
      <p className="text-xs text-gray-500">Odontograma este un instrument de documentare clinică. Diagnosticul și indicația terapeutică rămân responsabilitatea medicului.</p>
    </div>
  )
}

useGLTF.preload('/models/bookeasy-dental-chart.glb')
