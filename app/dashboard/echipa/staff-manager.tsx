'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardInteractive } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'

type StaffMember = { id: string; name: string; active: boolean; bookingsCount: number }

export default function StaffManager({ staff }: { staff: StaffMember[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  async function addStaff() {
    if (!newName.trim()) return
    setSaving(true)
    await fetch('/api/business/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    setNewName('')
    setAdding(false)
    setSaving(false)
    router.refresh()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch(`/api/business/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    setEditingId(null)
    setSaving(false)
    router.refresh()
  }

  async function toggleActive(member: StaffMember) {
    await fetch(`/api/business/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !member.active }),
    })
    router.refresh()
  }

  async function removeStaff(id: string) {
    if (!confirm('Elimini acest angajat? Dacă are rezervări în istoric, va fi doar dezactivat.')) return
    await fetch(`/api/business/staff/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Echipă</h1>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Anulează' : '+ Adaugă angajat'}</Button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {staff.length} angajați. Botul distribuie automat rezervările între angajații activi.
      </p>

      {adding && (
        <Card className="mb-4 flex gap-2">
          <Input placeholder="Nume angajat" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button variant="secondary" onClick={addStaff} disabled={saving || !newName.trim()}>
            Salvează
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {staff.map((member) => (
          <CardInteractive key={member.id} className="flex items-center justify-between">
            {editingId === member.id ? (
              <div className="flex gap-2 flex-1">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Button variant="secondary" onClick={() => saveEdit(member.id)} disabled={saving}>
                  Salvează
                </Button>
                <Button variant="secondary" onClick={() => setEditingId(null)}>
                  Anulează
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {member.bookingsCount} rezervări · <Pill tone={member.active ? 'success' : 'neutral'}>{member.active ? 'Activ' : 'Inactiv'}</Pill>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditingId(member.id)
                      setEditName(member.name)
                    }}
                    className="text-xs text-[var(--accent)] font-medium"
                  >
                    Editează
                  </button>
                  <button onClick={() => toggleActive(member)} className="text-xs text-gray-500 font-medium">
                    {member.active ? 'Dezactivează' : 'Activează'}
                  </button>
                  <button onClick={() => removeStaff(member.id)} className="text-xs text-red-600 font-medium">
                    Elimină
                  </button>
                </div>
              </>
            )}
          </CardInteractive>
        ))}
        {staff.length === 0 && !adding && <p className="text-sm text-gray-500">Niciun angajat adăugat încă.</p>}
      </div>
    </div>
  )
}
