'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'

type Provider = 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'GOOGLE_BUSINESS' | 'GOOGLE_CALENDAR'
type Channel = { id?: string; externalId: string; displayName?: string | null; wabaId?: string | null; authProvider?: string }
const idLabels = { FACEBOOK: 'Page ID', INSTAGRAM: 'Instagram Business Account ID', WHATSAPP: 'Phone Number ID', GOOGLE_BUSINESS: 'Resursa locației · accounts/123/locations/456', GOOGLE_CALENDAR: 'Calendar ID' }

export default function ManualIntegrationSettings({ businessId, type, channel, practitioners = [], individual = false }: { businessId: string; type: Provider; channel?: Channel; practitioners?: { id: string; name: string; googleCalendar?: { googleEmail: string | null; calendarId?: string } | null }[]; individual?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [selectedId, setSelectedId] = useState(individual ? practitioners[0]?.id || '' : '')
  const calendar = practitioners.find(p => p.id === selectedId)?.googleCalendar
  const router = useRouter()
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false)
    const form = event.currentTarget
    const fields = new FormData(form)
    const data = Object.fromEntries(fields.entries())
    const endpoint = type === 'GOOGLE_CALENDAR' ? 'calendar' : 'channels'
    try {
      const response = await fetch(`/api/superadmin/businesses/${encodeURIComponent(businessId)}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, type, expiresInMinutes: Number(fields.get('expiresInMinutes') || 60), syncEnabled: fields.get('syncEnabled') === 'on' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Verifică datele introduse.')
      form.querySelectorAll<HTMLInputElement>('input[type=password]').forEach(input => { input.value = '' })
      setSaved(true); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Salvarea a eșuat. Verifică conexiunea.') }
    finally { setBusy(false) }
  }
  async function disconnect() {
    if (!channel?.id || !window.confirm('Deconectezi integrarea acestei afaceri?')) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const response = await fetch(`/api/superadmin/businesses/${encodeURIComponent(businessId)}/channels/${encodeURIComponent(channel.id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Deconectarea a eșuat.')
      router.refresh()
      if (result.warning) window.alert(result.warning)
    } catch (error) { setError(error instanceof Error ? error.message : 'Deconectarea a eșuat.') }
    finally { setBusy(false) }
  }
  return <div>{channel?.id && <button type="button" className="mt-3 text-xs text-red-700" disabled={busy} onClick={() => void disconnect()}>Deconectează integrarea</button>}<details className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white/80 p-3"><summary className="cursor-pointer text-xs font-semibold text-gray-600"><KeyRound size={13} className="inline mr-1.5" />Configurare manuală · Superadmin</summary><form method="post" key={selectedId} className="mt-4 grid gap-3" onSubmit={save}>
    <p className="text-xs leading-relaxed text-gray-500">Introdu datele contului și tokenul furnizorului. Tokenurile sunt verificate și salvate criptat. Câmpurile goale păstrează tokenurile existente pentru același cont.</p>
    {type === 'GOOGLE_CALENDAR' && !individual && <label className="grid gap-1 text-xs text-gray-600">Membru al echipei<select name="practitionerId" required className="input-field w-full" value={selectedId} onChange={e => { setSelectedId(e.target.value); setError(''); setSaved(false) }}><option value="">Selectează profilul</option>{practitioners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    {type === 'GOOGLE_CALENDAR' && individual && practitioners[0] && <input type="hidden" name="practitionerId" value={practitioners[0].id} />}
    <label className="grid gap-1 text-xs text-gray-600">{type === 'GOOGLE_CALENDAR' ? 'Utilizator · email Google' : 'Utilizator / numele contului'}<input name="displayName" type={type === 'GOOGLE_CALENDAR' ? 'email' : 'text'} maxLength={200} required={type === 'GOOGLE_CALENDAR'} defaultValue={calendar?.googleEmail || channel?.displayName || ''} className="input-field w-full" autoComplete="off" /></label>
    <label className="grid gap-1 text-xs text-gray-600">{idLabels[type]}<input name="externalId" required maxLength={500} defaultValue={calendar?.calendarId || channel?.externalId || ''} className="input-field w-full" autoComplete="off" /></label>
    {type === 'INSTAGRAM' && <label className="grid gap-1 text-xs text-gray-600">Tipul tokenului<select name="authProvider" className="input-field w-full" defaultValue={channel?.authProvider || 'instagram'}><option value="instagram">Instagram Login</option><option value="meta">Facebook / Meta</option></select></label>}
    {type === 'WHATSAPP' && <label className="grid gap-1 text-xs text-gray-600">WhatsApp Business Account ID (WABA)<input name="wabaId" required pattern="[0-9]{5,}" defaultValue={channel?.wabaId || ''} className="input-field w-full" /></label>}
    <label className="grid gap-1 text-xs text-gray-600">Access token<input name="accessToken" type="password" maxLength={20000} autoComplete="new-password" spellCheck={false} className="input-field w-full" placeholder="Token nou sau gol pentru a-l păstra" /></label>
    {(type === 'GOOGLE_BUSINESS' || type === 'GOOGLE_CALENDAR') && <><label className="grid gap-1 text-xs text-gray-600">Refresh token<input name="refreshToken" type="password" maxLength={20000} autoComplete="new-password" spellCheck={false} className="input-field w-full" placeholder="Necesar pentru reînnoirea automată" /></label><label className="grid gap-1 text-xs text-gray-600">Valabilitatea access tokenului (minute)<input name="expiresInMinutes" type="number" min={1} max={525600} defaultValue={60} required className="input-field w-full" /></label></>}
    {type === 'GOOGLE_CALENDAR' && <label className="flex items-center gap-2 text-xs"><input name="syncEnabled" type="checkbox" defaultChecked />Activează sincronizarea programărilor în acest calendar</label>}
    {saved && <p role="status" className="text-xs text-green-700">Configurarea a fost verificată și salvată. Tokenurile nu sunt afișate.</p>}
    <button disabled={busy} className="btn-secondary text-xs justify-self-start">{busy ? 'Se verifică…' : 'Verifică și salvează manual'}</button>
  </form></details>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>
}
