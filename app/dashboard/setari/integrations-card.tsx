'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import MetaEmbeddedSignupV4Button from '@/components/meta-embedded-signup-v4-button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Channel = {
  id: string
  type: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'GOOGLE_BUSINESS' | 'WEB' | 'MANUAL'
  status: string
  externalId: string
}

type Practitioner = {
  id: string
  name: string
  googleCalendar: {
    googleEmail: string | null
    calendarName: string
    syncEnabled: boolean
    includeCustomerDetails: boolean
    lastSyncAt: Date | string | null
    lastError: string | null
  } | null
}

function ConnectionStatus({ connected, warning = false }: { connected: boolean; warning?: boolean }) {
  return <Pill tone={warning ? 'warning' : connected ? 'success' : 'neutral'}>{warning ? 'Necesită reconectare' : connected ? 'Conectat' : 'Neconectat'}</Pill>
}

function IndividualCalendar({ practitioner, businessName }: { practitioner: Practitioner; businessName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(practitioner.googleCalendar?.syncEnabled ?? true)
  const [includeCustomerDetails, setIncludeCustomerDetails] = useState(practitioner.googleCalendar?.includeCustomerDetails ?? false)

  async function save() {
    setBusy(true)
    try {
      const response = await fetchWithTimeout('/api/google-calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practitionerId: practitioner.id, syncEnabled, includeCustomerDetails }),
      })
      if (!response.ok) throw new Error()
      router.refresh()
    } catch {
      window.alert('Setările Google Calendar nu au putut fi salvate.')
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    try {
      const response = await fetchWithTimeout('/api/google-calendar/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practitionerId: practitioner.id }),
      })
      if (!response.ok) throw new Error()
      const data = await response.json()
      window.alert(`${data.count} programări au fost verificate și sincronizate.`)
      router.refresh()
    } catch {
      window.alert('Sincronizarea Google Calendar a eșuat.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('Deconectezi Google Calendar? Evenimentele deja create vor rămâne în calendar.')) return
    setBusy(true)
    try {
      const response = await fetchWithTimeout(`/api/google-calendar/settings?practitionerId=${encodeURIComponent(practitioner.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      router.refresh()
    } catch {
      window.alert('Deconectarea Google Calendar a eșuat.')
    } finally {
      setBusy(false)
    }
  }

  if (!practitioner.googleCalendar) {
    return (
      <div className="rounded-xl border border-blue-100 bg-white/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Calendarul {businessName}</p>
            <p className="text-xs text-gray-500">Calendar neconectat</p>
          </div>
          <a href={`/api/google-calendar/connect?source=settings&practitionerId=${encodeURIComponent(practitioner.id)}`} className="btn-secondary inline-flex text-xs">Conectează</a>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-white/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Calendarul {businessName}</p>
          <p className="truncate text-xs text-gray-500">{practitioner.googleCalendar.googleEmail ?? practitioner.googleCalendar.calendarName}</p>
        </div>
        <ConnectionStatus connected={syncEnabled} warning={Boolean(practitioner.googleCalendar.lastError)} />
      </div>
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-xs text-blue-950">
          <input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} />
          Sincronizare automată activă
        </label>
        <label className="flex items-start gap-2 text-xs text-blue-950">
          <input className="mt-0.5" type="checkbox" checked={includeCustomerDetails} onChange={(event) => setIncludeCustomerDetails(event.target.checked)} />
          <span>Include numele, telefonul și serviciul clientului în eveniment</span>
        </label>
        {practitioner.googleCalendar.lastError && <p className="text-xs text-red-600">Necesită atenție: {practitioner.googleCalendar.lastError}</p>}
        {practitioner.googleCalendar.lastSyncAt && !practitioner.googleCalendar.lastError && (
          <p className="text-xs text-emerald-700">Ultima sincronizare: {new Date(practitioner.googleCalendar.lastSyncAt).toLocaleString('ro-RO')}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={save} disabled={busy} className="text-xs">Salvează</Button>
          <Button variant="secondary" onClick={syncNow} disabled={busy} className="text-xs">Sincronizează acum</Button>
          <a href={`/api/google-calendar/connect?source=settings&practitionerId=${encodeURIComponent(practitioner.id)}`} className="btn-secondary inline-flex text-xs">Reconectează</a>
          <button type="button" className="px-2 text-xs text-red-600" onClick={disconnect} disabled={busy}>Deconectează</button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsCard({
  channels,
  practitioners,
  businessName,
  businessCategory,
  isIndividual,
  instagramOAuthEnabled,
  metaAppId,
  metaV4ConfigId,
}: {
  channels: Channel[]
  practitioners: Practitioner[]
  businessName: string
  businessCategory: string
  isIndividual: boolean
  instagramOAuthEnabled: boolean
  metaAppId: string
  metaV4ConfigId: string
}) {
  const searchParams = useSearchParams()
  const connected = searchParams.get('connected')
  const oauthError = searchParams.get('error')
  const googleStatus = searchParams.get('google')
  const facebook = channels.find((channel) => channel.type === 'FACEBOOK' && channel.status === 'ACTIVE')
  const instagram = channels.find((channel) => channel.type === 'INSTAGRAM' && channel.status === 'ACTIVE')
  const whatsapp = channels.find((channel) => channel.type === 'WHATSAPP' && channel.status === 'ACTIVE')
  const profileLabel = businessCategory === 'CLINICA' ? 'un medic' : businessCategory === 'SALON' ? 'un membru al echipei' : 'un profil de echipă'
  const individualPractitioner = practitioners[0]

  return (
    <Card className="mb-5 break-inside-avoid">
      <h2 className="font-medium mb-1">Integrări</h2>
      <p className="text-sm text-gray-500 mb-4">
        Conectează conturile direct la Meta și Google. BookEasy nu vede și nu salvează parolele tale.
      </p>

      {connected === 'messenger' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Messenger a fost conectat.</p>}
      {connected === 'instagram' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Instagram a fost conectat.</p>}
      {googleStatus === 'connected' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Google Calendar a fost conectat și sincronizat.</p>}
      {(oauthError || (googleStatus && googleStatus !== 'connected')) && (
        <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          Conectarea nu a reușit{oauthError ? `: ${oauthError}` : '. Încearcă din nou și verifică permisiunile contului.'}
        </p>
      )}

      <div className="space-y-3">
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Messenger</p>
              <p className="mt-1 text-xs text-gray-500">Selectează Pagina Facebook a afacerii. Se solicită numai permisiunile necesare pentru Messenger.</p>
            </div>
            <ConnectionStatus connected={Boolean(facebook)} />
          </div>
          <a href="/api/oauth/meta/start?source=settings&channel=messenger" className="btn-secondary mt-3 inline-flex text-sm">
            {facebook ? 'Reconectează Messenger' : 'Conectează Messenger'}
          </a>
        </section>

        <section className="rounded-2xl border border-pink-100 bg-pink-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-pink-950">Instagram</p>
              <p className="mt-1 text-xs text-pink-800">Conectare separată pentru contul profesional Instagram asociat unei Pagini Facebook.</p>
            </div>
            <ConnectionStatus connected={Boolean(instagram)} />
          </div>
          {instagramOAuthEnabled ? (
            <a href="/api/oauth/meta/start?source=settings&channel=instagram" className="btn-secondary mt-3 inline-flex text-sm">
              {instagram ? 'Reconectează Instagram' : 'Conectează Instagram'}
            </a>
          ) : (
            <p className="mt-3 text-xs font-medium text-amber-700">Înainte de conectare trebuie activate permisiunile Instagram în aplicația Meta.</p>
          )}
        </section>

        <section className="rounded-2xl border border-green-100 bg-green-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-green-950">WhatsApp Business</p>
              <p className="mt-1 text-xs text-green-800">Autorizare oficială prin Meta Embedded Signup v4.</p>
            </div>
            <ConnectionStatus connected={Boolean(whatsapp)} />
          </div>
          <div className="mt-3">
            <MetaEmbeddedSignupV4Button
              appId={metaAppId}
              configId={metaV4ConfigId}
              endpoint="/api/business/integrations/meta-whatsapp"
              label={whatsapp ? 'Reconectează WhatsApp' : 'Conectează WhatsApp'}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-950">Google Calendar</p>
          <p className="mt-1 text-xs text-blue-800">
            {isIndividual
              ? `BookEasy creează un calendar separat pentru ${businessName} și nu solicită acces la calendarele personale existente.`
              : 'BookEasy creează câte un calendar separat pentru fiecare membru al echipei și nu solicită acces la calendarele personale existente.'}
          </p>
          <div className="mt-3 space-y-2">
            {isIndividual && !individualPractitioner && (
              <div className="rounded-xl border border-blue-100 bg-white/80 p-3">
                <p className="mb-2 text-xs text-blue-900">Calendarul se configurează direct pentru afacere; nu trebuie să adaugi un profil în Medici/Echipă.</p>
                <a href="/api/google-calendar/connect?source=settings" className="btn-secondary inline-flex text-xs">Conectează Google Calendar</a>
              </div>
            )}
            {isIndividual && individualPractitioner && <IndividualCalendar practitioner={individualPractitioner} businessName={businessName} />}
            {!isIndividual && practitioners.length === 0 && <p className="text-xs text-blue-800">Adaugă mai întâi {profileLabel}.</p>}
            {!isIndividual && practitioners.map((practitioner) => (
              <div key={practitioner.id} className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{practitioner.name}</p>
                  <p className="truncate text-xs text-gray-500">{practitioner.googleCalendar?.googleEmail ?? practitioner.googleCalendar?.calendarName ?? 'Calendar neconectat'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ConnectionStatus connected={Boolean(practitioner.googleCalendar?.syncEnabled)} warning={Boolean(practitioner.googleCalendar?.lastError)} />
                  <a href={`/api/google-calendar/connect?source=settings&practitionerId=${encodeURIComponent(practitioner.id)}`} className="btn-secondary inline-flex text-xs">
                    {practitioner.googleCalendar ? 'Reconectează' : 'Conectează'}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Card>
  )
}
