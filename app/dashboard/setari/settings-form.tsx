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
  isMultiPractitioner,
}: {
  business: {
    name: string
    contactPhone: string
    city: string
    address: string
    publicListed: boolean
    slotIntervalMinutes: number | null
    minLeadTimeMinutes: number
    break1Start: string | null
    break1End: string | null
    break2Start: string | null
    break2End: string | null
    break3Start: string | null
    break3End: string | null
  }
  workingHours: WorkingHour[]
  isMultiPractitioner: boolean
}) {
  const [form, setForm] = useState(business)
  const [hours, setHours] = useState(workingHours)
  const [break1Enabled, setBreak1Enabled] = useState(!!business.break1Start)
  const [break2Enabled, setBreak2Enabled] = useState(!!business.break2Start)
  const [break3Enabled, setBreak3Enabled] = useState(!!business.break3Start)
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
        body: JSON.stringify({
          ...form,
          workingHours: hours,
          break1Start: break1Enabled ? form.break1Start : null,
          break1End: break1Enabled ? form.break1End : null,
          break2Start: break2Enabled ? form.break2Start : null,
          break2End: break2Enabled ? form.break2End : null,
          break3Start: break3Enabled ? form.break3Start : null,
          break3End: break3Enabled ? form.break3End : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }))
        setGeocoded(!!data.geocoded)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <h2 className="font-medium mb-4">Date profil</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Nume profil</label>
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
        <h2 className="font-medium mb-4">Program de lucru</h2>
        <div className="flex flex-col gap-2 mb-5">
          {hours.map((h) => (
            <div key={h.weekday} className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm py-1">
              <span className="w-20 sm:w-24 text-gray-600 shrink-0">{WEEKDAY_LABELS[h.weekday]}</span>
              <label className="flex items-center gap-1.5 text-gray-500 shrink-0">
                <input
                  type="checkbox"
                  checked={!h.closed}
                  onChange={(e) => updateHour(h.weekday, { closed: !e.target.checked })}
                />
                deschis
              </label>
              {!h.closed && (
                <div className="flex items-center gap-2 shrink-0">
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
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-[var(--border-soft)]">
          {isMultiPractitioner ? (
            <p className="text-sm text-gray-500">
              Profilul e setat pe "Echipă" — fiecare medic/angajat își setează propriile pauze din{' '}
              <a href="/dashboard/medici" className="text-[var(--accent)] underline">
                Medici
              </a>
              , unde știu cel mai bine când au pauză pe calendarul lor.
            </p>
          ) : (
            <>
              <h3 className="text-sm font-medium mb-1">Pauze</h3>
              <p className="text-xs text-gray-500 mb-3">
                Aceleași ore în fiecare zi lucrătoare — nu se pot face programări în aceste intervale.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
                    <input type="checkbox" checked={break1Enabled} onChange={(e) => setBreak1Enabled(e.target.checked)} />
                    Pauza 1
                  </label>
                  {break1Enabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={form.break1Start ?? '13:00'}
                        onChange={(e) => setForm({ ...form, break1Start: e.target.value })}
                        className="input-field"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={form.break1End ?? '14:00'}
                        onChange={(e) => setForm({ ...form, break1End: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
                    <input type="checkbox" checked={break2Enabled} onChange={(e) => setBreak2Enabled(e.target.checked)} />
                    Pauza 2
                  </label>
                  {break2Enabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={form.break2Start ?? '16:00'}
                        onChange={(e) => setForm({ ...form, break2Start: e.target.value })}
                        className="input-field"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={form.break2End ?? '16:15'}
                        onChange={(e) => setForm({ ...form, break2End: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
                    <input type="checkbox" checked={break3Enabled} onChange={(e) => setBreak3Enabled(e.target.checked)} />
                    Pauza 3
                  </label>
                  {break3Enabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={form.break3Start ?? '18:00'}
                        onChange={(e) => setForm({ ...form, break3Start: e.target.value })}
                        className="input-field"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={form.break3End ?? '18:15'}
                        onChange={(e) => setForm({ ...form, break3End: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-1">Interval între ore disponibile</h2>
        <p className="text-sm text-gray-500 mb-3">
          Cum se împart orele oferite clienților la rezervare.
        </p>
        <select
          value={form.slotIntervalMinutes ?? 'auto'}
          onChange={(e) => setForm({ ...form, slotIntervalMinutes: e.target.value === 'auto' ? null : Number(e.target.value) })}
          className="input-field w-full"
        >
          <option value="auto">Automat — după durata fiecărui serviciu (recomandat)</option>
          <option value="10">Fix, din 10 în 10 minute</option>
          <option value="15">Fix, din 15 în 15 minute</option>
          <option value="30">Fix, din 30 în 30 minute</option>
        </select>
        <p className="text-xs text-gray-400 mt-2">
          Indiferent de setare, două rezervări nu se pot suprapune niciodată — verificarea se face
          mereu pe durata reală a fiecărui serviciu.
        </p>
      </Card>

      <Card>
        <h2 className="font-medium mb-1">Interval minim pentru rezervări din exterior</h2>
        <p className="text-sm text-gray-500 mb-3">
          Rezervările venite prin bot (WhatsApp/Instagram/Facebook) sau de pe site nu se pot face
          mai aproape de acest interval — ca să ai timp să vezi programările. La fel și anulările
          făcute de clienți. Rezervările create manual de tine din dashboard nu sunt afectate — le
          poți face oricând, chiar cu 30 de minute înainte.
        </p>
        <select
          value={form.minLeadTimeMinutes}
          onChange={(e) => setForm({ ...form, minLeadTimeMinutes: Number(e.target.value) })}
          className="input-field w-full"
        >
          <option value="60">Minim 1 oră înainte</option>
          <option value="90">Minim 1 oră 30 min înainte</option>
          <option value="120">Minim 2 ore înainte (recomandat)</option>
          <option value="180">Minim 3 ore înainte</option>
        </select>
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
