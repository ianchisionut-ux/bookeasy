'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientProfileData } from '@/lib/client-profile'
import { Input } from '@/components/ui/input'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function ClientProfileForm({ profile }: { profile: ClientProfileData }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [phone, setPhone] = useState(profile.phone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setSaved(false)
    try {
      const response = await fetchWithTimeout('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName, lastName, phone }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Datele nu au putut fi salvate.'); return }
      setSaved(true)
      router.refresh()
    } catch { setError('Conexiune întreruptă. Încearcă din nou.') }
    finally { setBusy(false) }
  }

  return <form onSubmit={save} className="mb-5 space-y-3 border-t border-[var(--border-soft)] pt-5">
    <h2 className="font-semibold">Datele tale pentru rezervări</h2>
    <div><label htmlFor="profile-first-name" className="mb-1 block text-sm">Prenume</label><Input id="profile-first-name" autoComplete="given-name" required maxLength={80} value={firstName} disabled={busy} onChange={(event) => { setFirstName(event.target.value); setSaved(false) }} /></div>
    <div><label htmlFor="profile-last-name" className="mb-1 block text-sm">Nume</label><Input id="profile-last-name" autoComplete="family-name" maxLength={100} value={lastName} disabled={busy} onChange={(event) => { setLastName(event.target.value); setSaved(false) }} /></div>
    <div><label htmlFor="profile-email" className="mb-1 block text-sm">Email</label><Input id="profile-email" type="email" autoComplete="email" value={profile.email} readOnly className="bg-gray-50" /></div>
    <div><label htmlFor="profile-phone" className="mb-1 block text-sm">Telefon</label><Input id="profile-phone" type="tel" autoComplete="tel" required maxLength={30} value={phone} disabled={busy} onChange={(event) => { setPhone(event.target.value); setSaved(false) }} /></div>
    {!profile.phone && <p className="text-xs text-gray-500">Completează telefonul o singură dată. Îl vom folosi pentru rezervările următoare.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {saved && <p role="status" className="text-sm text-green-700">Datele au fost salvate.</p>}
    <button type="submit" className="btn-secondary min-h-11 w-full" disabled={busy}>{busy ? 'Se salvează...' : 'Salvează datele'}</button>
  </form>
}
