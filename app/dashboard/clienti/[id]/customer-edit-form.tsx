'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function CustomerEditForm({
  customerId,
  initial,
}: {
  customerId: string
  initial: { name: string; phone: string; email: string; notes: string }
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Nume</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fără nume" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Telefon</label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Email</label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>

      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Notițe interne</label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Ex: preferă programări dimineața, alergic la anumite produse..."
          className="min-h-[80px]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează modificările'}
        </Button>
        {savedAt && <span className="text-xs text-gray-500">Salvat la {savedAt}</span>}
      </div>
    </div>
  )
}
