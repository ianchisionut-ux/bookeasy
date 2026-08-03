'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'

type Channel = { id: string; type: string; externalId: string; wabaId: string | null; status: string }
type Business = {
  id: string
  slug: string
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
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)
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
    if (!confirm(`Trimiți un link de resetare a parolei către ${business.ownerEmail}?`)) return
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${business.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) setResetSentTo(data.email)
      else alert(data.error ?? 'A apărut o eroare.')
    } catch {
      alert('Conexiune eșuată. Verifică internetul și încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteForever() {
    const confirmation = prompt(`Această acțiune e ireversibilă. Scrie "${business.name}" pentru confirmare:`)
    if (confirmation !== business.name) return
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${business.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Ștergerea a eșuat.')
        return
      }
      router.push('/superadmin/afaceri')
    } catch {
      alert('Conexiune eșuată. Verifică internetul și încearcă din nou.')
    } finally {
      setLoading(false)
    }
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
            <a
              href={`/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              bookeasy.ro/{business.slug} ↗
            </a>
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
            🔑 Trimite link resetare parolă
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

        {resetSentTo && (
          <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">
            Link de configurare a parolei trimis către <strong>{resetSentTo}</strong>. Linkul expiră în 24 de ore.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Phone Number ID</label>
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ex: 126137824372250" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Access Token</label>
          <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Lasă gol dacă nu schimbi" type="password" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
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
  const [processor, setProcessor] = useState<'STRIPE' | 'NETOPIA' | 'EUPLATESC' | ''>('')
  const [fields, setFields] = useState({
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    netopiaApiKey: '',
    netopiaPosSignature: '',
    netopiaPublicKey: '',
    netopiaIsLive: false,
    euplatescMerchantId: '',
    euplatescSecretKey: '',
    euplatescIsLive: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    const payload: Record<string, any> = { paymentProcessor: processor || null }
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== '' && v !== false) payload[k] = v
    })

    await fetch(`/api/superadmin/businesses/${businessId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setFields({
      stripeSecretKey: '',
      stripeWebhookSecret: '',
      netopiaApiKey: '',
      netopiaPosSignature: '',
      netopiaPublicKey: '',
      netopiaIsLive: fields.netopiaIsLive,
      euplatescMerchantId: '',
      euplatescSecretKey: '',
      euplatescIsLive: fields.euplatescIsLive,
    })
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
        propriul cont — banii intră direct la ea, nu la bookeasy.ro.
      </p>

      <label className="text-sm text-gray-500 block mb-1.5">Procesor de plăți</label>
      <select value={processor} onChange={(e) => setProcessor(e.target.value as any)} className="input-field mb-4">
        <option value="">— Dezactivat —</option>
        <option value="STRIPE">Stripe</option>
        <option value="NETOPIA">Netopia</option>
        <option value="EUPLATESC">EuPlatesc.ro</option>
      </select>

      {processor === 'STRIPE' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Secret Key</label>
            <Input
              value={fields.stripeSecretKey}
              onChange={(e) => setFields({ ...fields, stripeSecretKey: e.target.value })}
              placeholder="Lasă gol dacă nu schimbi (sk_...)"
              type="password"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Webhook Signing Secret</label>
            <Input
              value={fields.stripeWebhookSecret}
              onChange={(e) => setFields({ ...fields, stripeWebhookSecret: e.target.value })}
              placeholder="Lasă gol dacă nu schimbi (whsec_...)"
              type="password"
            />
          </div>
          <p className="col-span-2 text-xs text-gray-400">
            Cheile se iau din Stripe Dashboard → Developers → API keys.
          </p>
        </div>
      )}

      {processor === 'NETOPIA' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">API Key</label>
            <Input value={fields.netopiaApiKey} onChange={(e) => setFields({ ...fields, netopiaApiKey: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">POS Signature</label>
            <Input value={fields.netopiaPosSignature} onChange={(e) => setFields({ ...fields, netopiaPosSignature: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <div className="col-span-2">
            <label className="text-sm text-gray-500 block mb-1.5">Public Key (pentru verificare IPN)</label>
            <Input value={fields.netopiaPublicKey} onChange={(e) => setFields({ ...fields, netopiaPublicKey: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={fields.netopiaIsLive} onChange={(e) => setFields({ ...fields, netopiaIsLive: e.target.checked })} />
            Cont live (nebifat = sandbox de test)
          </label>
          <p className="col-span-2 text-xs text-gray-400">
            Cheile se iau din contul Netopia al afacerii. Notify URL de configurat acolo:
            /api/webhooks/netopia/{'{slug}'}
          </p>
        </div>
      )}

      {processor === 'EUPLATESC' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Merchant ID</label>
            <Input value={fields.euplatescMerchantId} onChange={(e) => setFields({ ...fields, euplatescMerchantId: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Secret Key</label>
            <Input value={fields.euplatescSecretKey} onChange={(e) => setFields({ ...fields, euplatescSecretKey: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={fields.euplatescIsLive} onChange={(e) => setFields({ ...fields, euplatescIsLive: e.target.checked })} />
            Cont live (nebifat = sandbox de test)
          </label>
          <p className="col-span-2 text-xs text-gray-400">
            Cheile se iau din contul EuPlatesc.ro al afacerii. Silent URL de configurat acolo:
            /api/webhooks/euplatesc/{'{slug}'}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" onClick={save} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
        {saved && <span className="text-xs text-green-700">Salvat.</span>}
      </div>
    </Card>
  )
}
