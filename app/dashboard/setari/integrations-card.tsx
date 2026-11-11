'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { isAppointmentCategory } from '@/lib/business-categories'
import { integrationUrl } from '@/lib/integration-links'
import ManualIntegrationSettings from '@/components/admin/manual-integration-settings'
import MessengerBotToggle from '@/components/messenger-bot-toggle'
import SmsBusinessToggle from '@/components/sms-business-toggle'

type Channel = {
  id: string
  type: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'GOOGLE_BUSINESS' | 'WEB' | 'MANUAL'
  status: string
  externalId: string
  displayName?: string | null
  wabaId?: string | null
  authProvider?: string
  enabledByOwner?: boolean
}

type Practitioner = {
  id: string
  name: string
  googleCalendar: {
    googleEmail: string | null
    calendarName: string
    calendarId?: string
    syncEnabled: boolean
    includeCustomerDetails: boolean
    lastSyncAt: Date | string | null
    lastError: string | null
  } | null
}

function ConnectionStatus({ connected, warning = false }: { connected: boolean; warning?: boolean }) {
  return <Pill tone={warning ? 'warning' : connected ? 'success' : 'neutral'}>{warning ? 'Necesită reconectare' : connected ? 'Conectat' : 'Neconectat'}</Pill>
}

function DisconnectButton({ endpoint, service }: { endpoint: string; service: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function disconnect() {
    if (!window.confirm(`Deconectezi ${service}? Datele salvate și celelalte integrări rămân disponibile.`)) return
    setBusy(true)
    try {
      const response = await fetchWithTimeout(endpoint, { method: 'DELETE' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Deconectarea nu a reușit.')
      router.refresh()
      if (result.warning) window.alert(result.warning)
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Deconectarea nu a reușit.') }
    finally { setBusy(false) }
  }
  return <Button variant="secondary" type="button" disabled={busy} className="min-h-11 max-w-full whitespace-normal text-center text-xs text-red-700" onClick={() => void disconnect()}>{busy ? 'Se deconectează…' : `Deconectează ${service}`}</Button>
}

function IndividualCalendar({ practitioner, businessName, adminBusinessId }: { practitioner: Practitioner; businessName: string; adminBusinessId?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(practitioner.googleCalendar?.syncEnabled ?? true)
  const [includeCustomerDetails, setIncludeCustomerDetails] = useState(practitioner.googleCalendar?.includeCustomerDetails ?? false)

  async function save() {
    setBusy(true)
    try {
      const response = await fetchWithTimeout(integrationUrl('/api/google-calendar/settings', adminBusinessId), {
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
      const response = await fetchWithTimeout(integrationUrl('/api/google-calendar/settings', adminBusinessId), {
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
      const response = await fetchWithTimeout(integrationUrl(`/api/google-calendar/settings?practitionerId=${encodeURIComponent(practitioner.id)}`, adminBusinessId), { method: 'DELETE' })
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
          <a href={integrationUrl(`/api/google-calendar/connect?source=settings&practitionerId=${encodeURIComponent(practitioner.id)}`, adminBusinessId)} className="btn-secondary inline-flex min-h-11 max-w-full items-center justify-center whitespace-normal text-center text-xs">Conectează</a>
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
          <a href={integrationUrl(`/api/google-calendar/connect?source=settings&practitionerId=${encodeURIComponent(practitioner.id)}`, adminBusinessId)} className="btn-secondary inline-flex min-h-11 max-w-full items-center justify-center whitespace-normal text-center text-xs">Reconectează</a>
          <button type="button" className="px-2 text-xs text-red-600" onClick={disconnect} disabled={busy}>Deconectează</button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsCard({
  platformSmsReady,
  channels,
  practitioners,
  businessName,
  businessCategory,
  isIndividual,
  smsGateway,
  adminBusinessId,
}: {
  platformSmsReady?: boolean
  channels: Channel[]
  practitioners: Practitioner[]
  businessName: string
  businessCategory: string
  isIndividual: boolean
  instagramOAuthEnabled: boolean
  smsGateway: { apiUrl: string | null; hasApiKey: boolean; deviceId: number | null; phone: string | null; enabled: boolean; testedAt: string | Date | null; lastError: string | null; mode: string; paired: boolean; lastSeenAt: string | Date | null }
  adminBusinessId?: string
}) {
  const searchParams = useSearchParams()
  const connected = searchParams.get('connected')
  const oauthError = searchParams.get('error')
  const googleStatus = searchParams.get('google')
  const facebook = channels.find((channel) => channel.type === 'FACEBOOK' && channel.status === 'ACTIVE') ?? channels.find((channel) => channel.type === 'FACEBOOK')
  const instagram = channels.find((channel) => channel.type === 'INSTAGRAM' && channel.status === 'ACTIVE') ?? channels.find((channel) => channel.type === 'INSTAGRAM')
  const googleBusiness = channels.find((channel) => channel.type === 'GOOGLE_BUSINESS' && channel.status === 'ACTIVE') ?? channels.find((channel) => channel.type === 'GOOGLE_BUSINESS')
  const profileLabel = businessCategory === 'CLINICA' ? 'un medic' : isAppointmentCategory(businessCategory) ? 'un membru al echipei' : 'un profil de echipă'
  const individualPractitioner = practitioners[0]

  return (
    <Card className="mb-5 break-inside-avoid">
      <h2 className="font-medium mb-1">Integrări</h2>
      <p className="text-sm text-gray-500 mb-4">
        Conectează conturile proprii ale afacerii la Facebook, Instagram și Google. Fiecare conexiune aparține acestei afaceri. BookEasy nu salvează parolele tale.
      </p>

      {connected === 'meta' && <p role="status" className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Facebook & Instagram: autorizarea a fost salvată. Verifică starea fiecărui canal mai jos.</p>}
      {connected === 'messenger' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Messenger a fost conectat.</p>}
      {connected === 'instagram' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Instagram a fost conectat.</p>}
      {connected === 'google' && googleBusiness?.status === 'ACTIVE' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Google Business Profile a fost conectat.</p>}
      {googleStatus === 'connected' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Google Calendar a fost conectat și sincronizat.</p>}
      {(oauthError || (googleStatus && googleStatus !== 'connected')) && (
        <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          Conectarea nu a reușit{oauthError ? `: ${oauthError}` : '. Încearcă din nou și verifică permisiunile contului.'}
        </p>
      )}

      <div className="space-y-3">
        <section aria-label="Facebook & Instagram" className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <h3 className="text-sm font-semibold">Facebook &amp; Instagram</h3>
          <p className="mt-1 text-xs text-gray-500">O singură autorizare pentru Pagina Facebook, mesajele Messenger și contul Instagram profesional asociat paginii.</p>
          <div className="mt-3 space-y-2">
            {([{ label: 'Facebook / Messenger', channel: facebook }, { label: 'Instagram', channel: instagram }]).map(({ label, channel }) => (
              <div key={label} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-white/80 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{label}</p>
                  {channel && <p className="mt-1 break-all text-xs text-gray-500">{channel.displayName || channel.externalId}</p>}
                </div>
                <ConnectionStatus connected={channel?.status === 'ACTIVE'} warning={channel?.status === 'EXPIRED' || channel?.status === 'EXPIRING_SOON'} />
                {channel?.status === 'ACTIVE' && (label === 'Facebook / Messenger' || label === 'Instagram') && (
                  <div className="w-full border-t border-[var(--border-soft)] pt-2">
                    <MessengerBotToggle
                      channelId={channel.id}
                      enabled={channel.enabledByOwner ?? true}
                      channelName={label === 'Instagram' ? 'Instagram' : 'Messenger'}
                      businessId={adminBusinessId}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <a href={integrationUrl('/api/oauth/meta/start?source=settings&channel=both', adminBusinessId)} className="btn-secondary mt-3 inline-flex max-w-full whitespace-normal text-sm">{facebook || instagram ? 'Reconectează Facebook & Instagram' : 'Conectează Facebook & Instagram'}</a>
          {!adminBusinessId && (facebook || instagram) && <div><DisconnectButton endpoint="/api/business/integrations/meta" service="Facebook & Instagram" /></div>}
          {adminBusinessId && <div className="mt-4 space-y-3 border-t border-[var(--border-soft)] pt-3">
            <div>
              <p className="text-xs font-medium">Facebook / Messenger · configurare manuală</p>
              <ManualIntegrationSettings businessId={adminBusinessId} type="FACEBOOK" channel={facebook} />
            </div>
            <div>
              <p className="text-xs font-medium">Instagram · configurare manuală</p>
              <ManualIntegrationSettings businessId={adminBusinessId} type="INSTAGRAM" channel={instagram} />
            </div>
          </div>}
        </section>

        {platformSmsReady && <SmsBusinessToggle initial={smsGateway.enabled} businessId={adminBusinessId} />}

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-blue-950">Google Business Profile</p>
              <p className="mt-1 text-xs text-blue-800">Conectează profilul Google al afacerii pentru sincronizarea recenziilor.</p>
            </div>
            <ConnectionStatus connected={googleBusiness?.status === 'ACTIVE'} warning={googleBusiness?.status === 'EXPIRED' || googleBusiness?.status === 'EXPIRING_SOON'} />
          </div>
          <a href={integrationUrl('/api/oauth/google/start?source=settings', adminBusinessId)} className="btn-secondary mt-3 inline-flex text-sm">
            {googleBusiness ? 'Reconectează Google Business Profile' : 'Conectează Google Business Profile'}
          </a>
          {googleBusiness && <div className="mt-2"><DisconnectButton endpoint={integrationUrl('/api/business/integrations/google-business', adminBusinessId)} service="Google Business Profile" /></div>}
          {adminBusinessId && <ManualIntegrationSettings businessId={adminBusinessId} type="GOOGLE_BUSINESS" channel={channels.find(c => c.type === 'GOOGLE_BUSINESS')} />}
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
                <a href={integrationUrl('/api/google-calendar/connect?source=settings', adminBusinessId)} className="btn-secondary inline-flex min-h-11 max-w-full items-center justify-center whitespace-normal text-center text-xs">Conectează Google Calendar</a>
              </div>
            )}
            {isIndividual && individualPractitioner && <IndividualCalendar practitioner={individualPractitioner} businessName={businessName} adminBusinessId={adminBusinessId} />}
            {!isIndividual && practitioners.length === 0 && <p className="text-xs text-blue-800">Adaugă mai întâi {profileLabel}.</p>}
            {!isIndividual && practitioners.map((practitioner) => (
              <div key={practitioner.id} className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{practitioner.name}</p>
                  <p className="truncate text-xs text-gray-500">{practitioner.googleCalendar?.googleEmail ?? practitioner.googleCalendar?.calendarName ?? 'Calendar neconectat'}</p>
                </div>
                <div className="integration-calendar-actions">
                  <ConnectionStatus connected={Boolean(practitioner.googleCalendar?.syncEnabled)} warning={Boolean(practitioner.googleCalendar?.lastError)} />
                  <a href={integrationUrl(`/api/google-calendar/connect?source=settings&practitionerId=${encodeURIComponent(practitioner.id)}`, adminBusinessId)} className="btn-secondary inline-flex min-h-11 max-w-full items-center justify-center whitespace-normal text-center text-xs">
                    {practitioner.googleCalendar ? 'Reconectează' : 'Conectează'}
                  </a>
                  {practitioner.googleCalendar && <DisconnectButton endpoint={integrationUrl(`/api/google-calendar/settings?practitionerId=${encodeURIComponent(practitioner.id)}`, adminBusinessId)} service="Google Calendar" />}
                </div>
              </div>
            ))}
          </div>
          {adminBusinessId && <ManualIntegrationSettings businessId={adminBusinessId} type="GOOGLE_CALENDAR" practitioners={practitioners} individual={isIndividual} />}
        </section>
      </div>
    </Card>
  )
}
