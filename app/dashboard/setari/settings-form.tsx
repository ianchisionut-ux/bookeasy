'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const WEEKDAY_LABELS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

type WorkingHour = { weekday: number; startTime: string; endTime: string; closed: boolean }

export default function SettingsForm({
  business,
  workingHours,
}: {
  business: { name: string; contactPhone: string; city: string; address: string; publicListed: boolean; teamSize: number }
  workingHours: WorkingHour[]
}) {
  const [form, setForm] = useState(business)
  const [hours, setHours] = useState(workingHours)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [geocoded, setGeocoded] = useState(false)

  function updateHour(weekday: number, patch: Partial<WorkingHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))
  }

  async function handleSave() {
    setSaving(true)
    setGeocoded(false)
    try {
      const res = await fetch('/api/business/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, workingHours: hours }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
        setGeocoded(!!data.geocoded)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <h2 className="font-medium mb-4">Date afacere</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Nume afacere</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Telefon contact</label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Oraș</label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Adresă</label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Vizibil pe harta publică</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Afacerea apare pe /harta și pe pagina publică bookeasy.ro
            </p>
          </div>
          <button
            onClick={() => setForm({ ...form, publicListed: !form.publicListed })}
            className="pill w-11 h-6 flex items-center px-0.5 transition"
            style={{ background: form.publicListed ? 'var(--accent)' : '#e5e5ea' }}
          >
            <span
              className="pill w-5 h-5 bg-white transition-transform"
              style={{ transform: form.publicListed ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Număr membri echipă</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {form.teamSize <= 1
                ? 'Afacere individuală — calendarul rămâne simplu, fără coloane per angajat.'
                : `${form.teamSize} membri — calendarul afișează o coloană per angajat.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm({ ...form, teamSize: Math.max(1, form.teamSize - 1) })}
              className="w-8 h-8 rounded-full border border-[var(--border-soft)] flex items-center justify-center text-lg"
            >
              −
            </button>
            <span className="w-6 text-center font-medium">{form.teamSize}</span>
            <button
              onClick={() => setForm({ ...form, teamSize: form.teamSize + 1 })}
              className="w-8 h-8 rounded-full border border-[var(--border-soft)] flex items-center justify-center text-lg"
            >
              +
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-4">Program de lucru</h2>
        <div className="flex flex-col gap-2">
          {hours.map((h) => (
            <div key={h.weekday} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-gray-600">{WEEKDAY_LABELS[h.weekday]}</span>
              <label className="flex items-center gap-1.5 text-gray-500">
                <input
                  type="checkbox"
                  checked={!h.closed}
                  onChange={(e) => updateHour(h.weekday, { closed: !e.target.checked })}
                />
                deschis
              </label>
              {!h.closed && (
                <>
                  <input
                    type="time"
                    value={h.startTime}
                    onChange={(e) => updateHour(h.weekday, { startTime: e.target.value })}
                    className="input-field"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="time"
                    value={h.endTime}
                    onChange={(e) => updateHour(h.weekday, { endTime: e.target.value })}
                    className="input-field"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează setările'}
        </Button>
        {savedAt && <span className="text-xs text-gray-500">Salvat la {savedAt}</span>}
        {geocoded && <span className="text-xs text-green-700">· locația a fost actualizată pe hartă</span>}
      </div>
    </div>
  )
}
