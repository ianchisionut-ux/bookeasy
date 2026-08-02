'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function CustomerNotes({
  customerId,
  initialNotes,
}: {
  customerId: string
  initialNotes: string
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-2">Notițe interne</label>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ex: preferă programări dimineața, alergic la anumite produse..."
        className="min-h-[80px]"
      />
      <div className="flex items-center gap-3 mt-3">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează notițe'}
        </Button>
        {savedAt && <span className="text-xs text-gray-500">Salvat la {savedAt}</span>}
      </div>
    </div>
  )
}
