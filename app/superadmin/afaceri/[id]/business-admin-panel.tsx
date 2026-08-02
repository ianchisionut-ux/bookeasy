'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'

type Channel = { id: string; type: string; externalId: string; wabaId: string | null; status: string }
type Business = {
  id: string
  name: string
  category: 'SALON' | 'EVENT_VENUE'
  accountActive: boolean
  publicListed: boolean
  ownerEmail: string | null
  bookingsCount: number
  revenue: number
  planName: string | null
}

export default function BusinessAdminPanel({ business, channels }: { business: Business; channels: Channel[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(business.name)
  const [resetResult, setResetResult] = useState<{ email: string; newPassword: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function saveName() {
    setLoading(true)
    await fetch(`/api/superadmin/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setEditing(false)
    setLoading(false)
    router.refresh()
  }

  async function toggleActive() {
    setLoading(true)
    await fetch(`/api/superadmin/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountActive: !business.accountActive }),
    })
    setLoading(false)
    router.refresh()
  }

  async function resetPassword() {
    if (!confirm(`Resetezi parola pentru ${business.ownerEmail}?`)) return
    setLoading(true)
    const res = await fetch(`/api/superadmin/businesses/${business.id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setResetResult(data)
    setLoading(false)
  }

  async function deleteForever() {
    const confirmation = prompt(`Această acțiune e ireversibilă. Scrie "${business.name}" pentru confirmare:`)
    if (confirmation !== business.name) return
    setLoading(true)
    await fetch(`/api/superadmin/businesses/${business.id}`, { method: 'DELETE' })
    router.push('/superadmin/afaceri')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header — nume, status, stats */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {editing ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
              ) : (
                <h1 className="text-xl font-semibold">{business.name}</h1>
              )}
              <Pill tone="accent">{business.category === 'SALON' ? 'Salon' : 'Spații evenimente'}</Pill>
              <Pill tone={business.accountActive ? 'success' : 'danger'}>{business.accountActive ? 'Activ' : 'Dezactivat'}</Pill>
            </div>
            <p className="text-sm text-gray-500">
              {business.ownerEmail ?? 'fără cont owner'} · {business.planName ?? 'fără abonament'}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{business.bookingsCount} rezervări</p>
            <p className="text-gray-500">{business.revenue.toLocaleString('ro-RO')} lei încasări est.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={saveName} disabled={loading}>
                Salvează numele
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Anulează
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              ✎ Editează
            </Button>
          )}
          <Button variant="secondary" onClick={resetPassword} disabled={loading || !business.ownerEmail}>
            🔑 Resetează parola
          </Button>
          <button
            onClick={toggleActive}
            disabled={loading}
            className={`btn-secondary ${business.accountActive ? 'text-red-600' : 'text-green-700'}`}
          >
            {business.accountActive ? 'Dezactivează' : 'Activează'}
          </button>
          <button onClick={deleteForever} disabled={loading} className="btn-secondary text-red-600">
            🗑 Șterge definitiv
          </button>
        </div>

        {resetResult && (
          <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">
            Parolă nouă pentru <strong>{resetResult.email}</strong>: <code>{resetResult.newPassword}</code>
            <br />
            Transmite-o owner-ului acum — nu mai e afișată după ce părăsești pagina.
          </div>
        )}
      </Card>

      <ChannelSection
        businessId={business.id}
        label="MESSENGER"
        type="FACEBOOK"
        channel={channels.find((c) => c.type === 'FACEBOOK') ?? null}
        idLabel="Page ID"
        idPlaceholder="ex: 120984102888104"
      />

      <ChannelSection
        businessId={business.id}
        label="INSTAGRAM"
        type="INSTAGRAM"
        channel={channels.find((c) => c.type === 'INSTAGRAM') ?? null}
        idLabel="Instagram Business Account ID"
        idPlaceholder="ex: 178414000000000"
        helpText="Contul Instagram trebuie să fie profesional (Business/Creator) și legat de aceeași Pagină de Facebook ca Messenger."
      />

      <WhatsAppSection businessId={business.id} channel={channels.find((c) => c.type === 'WHATSAPP') ?? null} />

      <ChannelSection
        businessId={business.id}
        label="GOOGLE BUSINESS PROFILE"
        type="GOOGLE_BUSINESS"
        channel={channels.find((c) => c.type === 'GOOGLE_BUSINESS') ?? null}
        idLabel="Location / Account ID"
        idPlaceholder="ex: accounts/123/locations/456"
      />

      <PaymentSection businessId={business.id} />
    </div>
  )
}

function ChannelSection({
  businessId,
  label,
  type,
  channel,
  idLabel,
  idPlaceholder,
  helpText,
}: {
  businessId: string
  label: string
  type: string
  channel: Channel | null
  idLabel: string
  idPlaceholder: string
  helpText?: string
}) {
  const router = useRouter()
  const [externalId, setExternalId] = useState(channel?.externalId ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/superadmin/businesses/${businessId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, externalId, accessToken: accessToken || undefined }),
    })
    setAccessToken('')
    setSaving(false)
    router.refresh()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-500 tracking-wide">{label}</h2>
        {channel && <Pill tone={channel.status === 'ACTIVE' ? 'success' : 'neutral'}>{channel.status}</Pill>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">{idLabel}</label>
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder={idPlaceholder} />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Access Token</label>
          <Input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Lasă gol dacă nu schimbi"
            type="password"
          />
        </div>
      </div>
      {helpText && <p className="text-xs text-gray-400 mt-2">{helpText}</p>}
      <div className="mt-3">
        <Button variant="secondary" onClick={save} disabled={saving || !externalId}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
      </div>
    </Card>
  )
}

function WhatsAppSection({ businessId, channel }: { businessId: string; channel: Channel | null }) {
  const router = useRouter()
  const [externalId, setExternalId] = useState(channel?.externalId ?? '')
  const [wabaId, setWabaId] = useState(channel?.wabaId ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    setSaving(true)
    await fetch(`/api/superadmin/businesses/${businessId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'WHATSAPP', externalId, wabaId, accessToken: accessToken || undefined }),
    })
    setAccessToken('')
    setSaving(false)
    router.refresh()
  }

  async function subscribe() {
    setSubscribing(true)
    setMessage('')
    const res = await fetch(`/api/superadmin/businesses/${businessId}/whatsapp-subscribe`, { method: 'POST' })
    const data = await res.json()
    setMessage(res.ok ? 'Abonat cu succes — webhook-ul WhatsApp e activ.' : data.error)
    setSubscribing(false)
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-500 tracking-wide">WHATSAPP</h2>
        {channel && <Pill tone={channel.status === 'ACTIVE' ? 'success' : 'neutral'}>{channel.status}</Pill>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Phone Number ID</label>
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ex: 126137824372250" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Access Token</label>
          <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Lasă gol dacă nu schimbi" type="password" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">WhatsApp Business Account ID (WABA)</label>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="ex: 120826654809241" />
        </div>
        <div className="flex items-end">
          <button onClick={subscribe} disabled={subscribing} className="btn-secondary w-full">
            {subscribing ? 'Se abonează...' : 'Abonează aplicația la WhatsApp'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Pas obligatoriu, o singură dată per business — altfel WhatsApp nu trimite niciun mesaj către
        webhook, chiar dacă restul e configurat corect. Salvează întâi Token-ul și WABA ID-ul, apoi apasă butonul.
      </p>

      {message && <p className="text-xs mt-2 text-[var(--accent)]">{message}</p>}

      <div className="mt-3">
        <Button variant="secondary" onClick={save} disabled={saving || !externalId}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
      </div>
    </Card>
  )
}

function PaymentSection({ businessId }: { businessId: string }) {
  const [stripeSecretKey, setStripeSecretKey] = useState('')
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/superadmin/businesses/${businessId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripeSecretKey: stripeSecretKey || undefined, stripeWebhookSecret: stripeWebhookSecret || undefined }),
    })
    setStripeSecretKey('')
    setStripeWebhookSecret('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card>
      <h2 className="text-xs font-semibold text-gray-500 tracking-wide mb-1">
        PLATĂ ONLINE — CONTUL PROPRIU AL AFACERII
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Relevant pentru spații de evenimente care încasează avans direct. Fiecare afacere folosește
        propriul cont Stripe — banii intră direct la ea, nu la bookeasy.ro.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Secret Key</label>
          <Input value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)} placeholder="Lasă gol dacă nu schimbi (sk_...)" type="password" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Webhook Signing Secret</label>
          <Input value={stripeWebhookSecret} onChange={(e) => setStripeWebhookSecret(e.target.value)} placeholder="Lasă gol dacă nu schimbi (whsec_...)" type="password" />
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Cheile se iau din Stripe Dashboard → Developers → API keys. Webhook-ul se configurează în
        Stripe: /api/webhooks/stripe, eveniment checkout.session.completed.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" onClick={save} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
        {saved && <span className="text-xs text-green-700">Salvat.</span>}
      </div>
    </Card>
  )
}
