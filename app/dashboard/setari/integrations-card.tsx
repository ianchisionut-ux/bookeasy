'use client'

import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import MetaEmbeddedSignupV4Button from '@/components/meta-embedded-signup-v4-button'

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
    lastError: string | null
  } | null
}

function ConnectionStatus({ connected, warning = false }: { connected: boolean; warning?: boolean }) {
  return <Pill tone={warning ? 'warning' : connected ? 'success' : 'neutral'}>{warning ? 'Necesită reconectare' : connected ? 'Conectat' : 'Neconectat'}</Pill>
}

export default function IntegrationsCard({
  channels,
  practitioners,
  metaAppId,
  metaV4ConfigId,
}: {
  channels: Channel[]
  practitioners: Practitioner[]
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

  return (
    <Card className="mb-5 break-inside-avoid">
      <h2 className="font-medium mb-1">Integrări</h2>
      <p className="text-sm text-gray-500 mb-4">
        Conectează conturile direct la Meta și Google. BookEasy nu vede și nu salvează parolele tale.
      </p>

      {connected === 'meta' && <p className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">Contul Meta a fost autorizat.</p>}
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
              <p className="text-sm font-semibold">Messenger și Instagram</p>
              <p className="mt-1 text-xs text-gray-500">Selectează Pagina Facebook a afacerii. Instagram trebuie să fie un cont profesional asociat acelei pagini.</p>
            </div>
            <div className="flex gap-1.5"><ConnectionStatus connected={Boolean(facebook)} /><ConnectionStatus connected={Boolean(instagram)} /></div>
          </div>
          <a href="/api/oauth/meta/start" className="btn-secondary mt-3 inline-flex text-sm">
            {facebook || instagram ? 'Reconectează Meta' : 'Conectează Meta'}
          </a>
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
          <p className="mt-1 text-xs text-blue-800">BookEasy creează câte un calendar separat și nu solicită acces la calendarele personale existente.</p>
          <div className="mt-3 space-y-2">
            {practitioners.length === 0 && <p className="text-xs text-blue-800">Adaugă mai întâi un profil în Medici/Echipă.</p>}
            {practitioners.map((practitioner) => (
              <div key={practitioner.id} className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{practitioner.name}</p>
                  <p className="truncate text-xs text-gray-500">{practitioner.googleCalendar?.googleEmail ?? practitioner.googleCalendar?.calendarName ?? 'Calendar neconectat'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ConnectionStatus connected={Boolean(practitioner.googleCalendar?.syncEnabled)} warning={Boolean(practitioner.googleCalendar?.lastError)} />
                  <a href={`/api/google-calendar/connect?practitionerId=${encodeURIComponent(practitioner.id)}`} className="btn-secondary inline-flex text-xs">
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
