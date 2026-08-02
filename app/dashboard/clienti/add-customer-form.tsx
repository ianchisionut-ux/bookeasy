'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AddCustomerForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'A apărut o eroare.')
      setSaving(false)
      return
    }
    setForm({ name: '', phone: '', email: '' })
    setOpen(false)
    setSaving(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="mb-5">
        + Adaugă client
      </Button>
    )
  }

  return (
    <Card className="mb-5 max-w-sm">
      <div className="flex flex-col gap-2">
        <Input placeholder="Nume" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input placeholder="Email (opțional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSave} disabled={saving || !form.phone}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Anulează
          </Button>
        </div>
      </div>
    </Card>
  )
}
