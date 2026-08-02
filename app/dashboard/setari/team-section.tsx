'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type StaffMember = { id: string; name: string; bookingsCount: number }

export default function TeamSection({
  initialTeamSize,
  initialStaff,
  category,
}: {
  initialTeamSize: number
  initialStaff: StaffMember[]
  category: 'SALON' | 'EVENT_VENUE'
}) {
  const router = useRouter()
  const [teamSize, setTeamSize] = useState(initialTeamSize)
  const [staff, setStaff] = useState(initialStaff)
  const [syncing, setSyncing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // secțiunea de profesioniști are sens doar pentru saloane — la spații de evenimente
  // nu există conceptul de "angajat alocat unei rezervări", doar săli
  if (category !== 'SALON') return null

  async function changeTeamSize(next: number) {
    const clamped = Math.max(1, next)
    setTeamSize(clamped)
    setSyncing(true)
    const res = await fetch('/api/business/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamSize: clamped }),
    })
    const data = await res.json()
    setStaff(data.staff ?? [])
    setSyncing(false)
    router.refresh()
  }

  async function saveName(id: string) {
    await fetch(`/api/business/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, name: editName } : s)))
    setEditingId(null)
    router.refresh()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Număr membri echipă</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeTeamSize(teamSize - 1)}
            disabled={syncing || teamSize <= 1}
            className="w-8 h-8 rounded-full border border-[var(--border-soft)] flex items-center justify-center text-lg disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center font-medium">{teamSize}</span>
          <button
            onClick={() => changeTeamSize(teamSize + 1)}
            disabled={syncing}
            className="w-8 h-8 rounded-full border border-[var(--border-soft)] flex items-center justify-center text-lg disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {teamSize <= 1
          ? 'Afacere individuală — calendarul rămâne simplu, fără coloane per profesionist.'
          : `Calendarul arată o coloană per profesionist. Editează numele fiecăruia mai jos.`}
      </p>

      {teamSize > 1 && (
        <div className="flex flex-col gap-2">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between border border-[var(--border-soft)] rounded-xl px-4 py-2.5">
              {editingId === s.id ? (
                <div className="flex gap-2 flex-1">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <button onClick={() => saveName(s.id)} className="text-xs text-[var(--accent)] font-medium whitespace-nowrap">
                    Salvează
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.bookingsCount} rezervări</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(s.id)
                      setEditName(s.name)
                    }}
                    className="text-xs text-[var(--accent)] font-medium"
                  >
                    Editează numele
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
