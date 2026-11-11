'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Mode = 'STANDARD' | 'PRO' | 'FREE' | 'CAMPAIGN'
type Campaign = { id: string; code: string; name: string; freeMonths: number; freeUntilNotice:boolean; open: boolean }

export default function BillingModeCard({ businessId, initialMode, initialPlanName, initialCampaignId, campaigns }: {
  businessId: string
  initialMode: 'PAID' | 'FREE' | 'CAMPAIGN'
  initialPlanName: string | null
  initialCampaignId: string | null
  campaigns: Campaign[]
}) {
  const router = useRouter()
  const selectedMode: Mode = initialMode === 'PAID' ? initialPlanName?.toUpperCase() === 'PRO' ? 'PRO' : 'STANDARD' : initialMode
  const [mode, setMode] = useState<Mode>(selectedMode)
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? campaigns.find(c => c.open)?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const changed = mode !== selectedMode || (mode === 'CAMPAIGN' && campaignId !== initialCampaignId)

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const response = await fetchWithTimeout(`/api/superadmin/businesses/${businessId}/billing-mode`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'CAMPAIGN' ? { mode, campaignId } : { mode }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'Tipul contului nu a putut fi schimbat.')
      setMessage('Tipul contului a fost actualizat.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Conexiunea a eșuat.')
    } finally { setSaving(false) }
  }

  return <Card>
    <h2 className="font-medium">Tipul contului</h2>
    <p className="mt-1 text-sm text-gray-500">Alege planul și modul de facturare al afacerii. Schimbarea nu șterge perioadele deja înregistrate.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {([
        ['FREE', 'FREE', 'Fără abonament lunar'],
        ['STANDARD', 'STANDARD', 'Tariful curent din Planuri și prețuri'],
        ['PRO', 'PRO', 'Tarif configurat manual'],
        ['CAMPAIGN', 'CAMPANIE', 'Acces PRO · oferta codului'],
      ] as const).map(([value, label, description]) => <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className={`rounded-xl border p-3 text-left transition ${mode === value ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-gray-200 bg-white'}`}>
        <strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs text-gray-500">{description}</span>
      </button>)}
    </div>
    {mode === 'CAMPAIGN' && <label className="mt-4 block text-sm">Campanie
      <select className="input-field mt-1 w-full" value={campaignId} onChange={event => setCampaignId(event.target.value)}>
        <option value="">Alege codul promoțional</option>
        {campaigns.filter(c => c.open || c.id === initialCampaignId).map(c => <option key={c.id} value={c.id}>{c.name} · {c.code} · {c.freeUntilNotice?'Gratuit, fără termen':`${c.freeMonths} luni gratuite`}{c.open ? '' : ' (închisă)'}</option>)}
      </select>
    </label>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button onClick={save} disabled={!changed || saving || (mode === 'CAMPAIGN' && !campaignId)}>{saving ? 'Se salvează…' : 'Salvează tipul contului'}</Button>
      {changed && <span className="text-xs text-amber-700">Modificare nesalvată</span>}
    </div>
    {message && <p role="status" className={`mt-3 text-sm ${message.includes('actualizat') ? 'text-green-700' : 'text-red-700'}`}>{message}</p>}
  </Card>
}
