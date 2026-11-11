'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useState } from 'react'
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import BillingSection from './billing-section'
import { CATEGORY_LABEL, type BusinessCategory } from '@/lib/business-categories'
import SmsRoutingSettings from '@/components/admin/sms-routing-settings'
import SharedIntegrationsCard from '@/app/dashboard/setari/integrations-card'
import BillingModeCard from './billing-mode-card'

type Channel = { id: string; type: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'GOOGLE_BUSINESS' | 'WEB' | 'MANUAL'; externalId: string; displayName?: string | null; authProvider?: string; wabaId: string | null; status: string; enabledByOwner: boolean }
type CalendarPractitioner = {
  id: string
  name: string
  googleCalendar: { googleEmail: string | null; calendarName: string; calendarId: string; syncEnabled: boolean; includeCustomerDetails: boolean; lastSyncAt: Date | string | null; lastError: string | null } | null
}
type Business = {
  id: string
  slug: string
  name: string
  category: BusinessCategory
  dentalClinic: boolean
  accountActive: boolean
  publicListed: boolean
  ownerEmail: string | null
  bookingsCount: number
  planName: string | null
  teamSize: number
  billingStatus: 'GRATUIT' | 'NEPLATIT' | 'PLATIT' | 'RESTANT'
  billingNote: string | null
  billingAmount: number | null
  billingSubtotal: number | null
  billingVatRate: number
  billingDueAt: string | null
  billingInvoiceName: string | null
  billingIpayPaymentState: string | null
  billingIpayPaymentError: string | null
  billingPaidAt: string | null
  billingLegalName: string | null
  billingClientType: string
  billingCif: string | null
  billingRegCom: string | null
  billingAddress: string | null
  billingCounty: string | null
  billingCity: string | null
  billingPostalCode: string | null
  billingEmail: string | null
  contractRepresentativeName: string | null
  contractRepresentativeRole: string | null
  smsGatewayApiUrl: string | null
  smsGatewayHasApiKey: boolean
  smsGatewayDeviceId: number | null
  smsGatewayPhone: string | null
  smsGatewayEnabled: boolean
  smsGatewayTestedAt: string | null
  smsGatewayLastError: string | null
  smsSenderMode: string
  smsGatewayMode: string
  smsDevicePaired: boolean
  smsDeviceLastSeenAt: string | null
}

export default function BusinessAdminPanel({ business, channels, practitioners, metaAppId, metaWhatsappConfigId, instagramOAuthEnabled, campaignManaged = false, billingMode, currentCampaignId, campaigns, platformSmsReady }: { business: Business; channels: Channel[]; practitioners: CalendarPractitioner[]; metaAppId: string; metaWhatsappConfigId: string; instagramOAuthEnabled: boolean; campaignManaged?: boolean; billingMode: 'PAID' | 'FREE' | 'CAMPAIGN'; currentCampaignId: string | null; campaigns: { id: string; code: string; name: string; freeMonths: number; open: boolean }[]; platformSmsReady: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(business.name)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [teamMode, setTeamMode] = useState(business.category !== 'FITNESS' && business.teamSize > 1)
  const [savingTeam, setSavingTeam] = useState(false)
  const [teamSaved, setTeamSaved] = useState(false)
  const [dentalClinic, setDentalClinic] = useState(business.dentalClinic)
  const [savingDentalClinic, setSavingDentalClinic] = useState(false)
  const [demoLinkCopied, setDemoLinkCopied] = useState(false)
  const [openingDashboard, setOpeningDashboard] = useState(false)
  const teamModeChanged = teamMode !== (business.teamSize > 1)

  async function saveTeamMode() {
    setSavingTeam(true)
    setTeamSaved(false)
    try {
      await fetch(`/api/superadmin/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamSize: teamMode ? 2 : 1 }),
      })
      setTeamSaved(true)
      router.refresh()
    } finally {
      setSavingTeam(false)
    }
  }

  async function saveDentalClinic(nextValue: boolean) {
    setSavingDentalClinic(true)
    try {
      const response = await fetch(`/api/superadmin/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dentalClinic: nextValue }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        alert(data.error ?? 'Setarea nu a putut fi salvată.')
        return
      }
      setDentalClinic(nextValue)
      router.refresh()
    } finally {
      setSavingDentalClinic(false)
    }
  }

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
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${business.id}`, { method: 'DELETE' }, 30000)
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

  async function copyDemoLink() {
    const demoUrl = `${window.location.origin}/demo/${business.slug}`
    try {
      await navigator.clipboard.writeText(demoUrl)
      setDemoLinkCopied(true)
      window.setTimeout(() => setDemoLinkCopied(false), 2500)
    } catch {
      window.prompt('Copiază linkul demonstrației:', demoUrl)
    }
  }

  async function openBusinessDashboard() {
    setOpeningDashboard(true)
    try {
      const response = await fetch(`/api/superadmin/businesses/${business.id}/access`, { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        alert(data.error ?? 'Nu am putut deschide dashboard-ul.')
        return
      }
      window.location.assign(data.redirectTo ?? '/dashboard/calendar')
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setOpeningDashboard(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 items-start xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
      {/* Header — nume, status, stats — pe toată lățimea */}
      <Card className="xl:col-span-2">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {editing ? (
                <Input aria-label="Nume afișat public (brand)" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
              ) : (
                <h1 className="text-xl font-semibold">{business.name}</h1>
              )}
              <Pill tone="accent">{CATEGORY_LABEL[business.category] ?? business.category}</Pill>
              <Pill tone={business.category !== 'FITNESS' && business.teamSize > 1 ? 'accent' : 'neutral'}>
                {business.category === 'FITNESS' ? '1 instructor' : business.teamSize > 1 ? 'Echipă' : 'Individual'}
              </Pill>
              <Pill tone={business.accountActive ? 'success' : 'danger'}>{business.accountActive ? 'Activ' : 'Dezactivat'}</Pill>
            </div>
            <p className="text-sm text-gray-500">
              {business.ownerEmail ?? 'fără cont owner'} · {business.planName ?? 'fără abonament'}
            </p>
            <p className="mt-1 text-xs text-gray-500">Nume afișat public (brand). Datele juridice și de facturare se editează separat mai jos.</p>
            <a
              href={`/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              bookeasy.ro/{business.slug} ↗
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href={`/demo/${business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Deschide modul demonstrație ↗
              </a>
              <button type="button" onClick={copyDemoLink} className="text-xs font-medium text-[var(--accent)] hover:underline">
                {demoLinkCopied ? 'Link copiat ✓' : 'Copiază linkul demo'}
              </button>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{business.bookingsCount} rezervări</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={openBusinessDashboard} disabled={openingDashboard}>
            {openingDashboard ? 'Se deschide…' : 'Intră în dashboard'}
          </Button>
          {editing ? (
            <>
              <Button variant="secondary" onClick={saveName} disabled={loading}>
                Salvează brandul
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

      {/* Coloana stângă — profil, facturare */}
      <div className="flex flex-col gap-5">
        <BillingModeCard key={`${billingMode}-${business.planName}-${currentCampaignId}`} businessId={business.id} initialMode={billingMode} initialPlanName={business.planName} initialCampaignId={currentCampaignId} campaigns={campaigns} />
        {business.category === 'FITNESS' ? <Card><h2 className="font-medium mb-2">Un instructor · o afacere</h2><p className="text-sm text-gray-500">Instructorul își gestionează propriii clienți, planurile și cele trei calendare: programări, antrenamente și nutriție.</p></Card> : <Card>
          <h2 className="font-medium mb-1">Profilul afacerii</h2>
          <p className="text-sm text-gray-500 mb-3">
            Individual — un singur calendar, gestiune unică (ca acum). Echipă — proprietarul poate
            adăuga mai mulți medici/angajați, fiecare cu programul lui, calendar separabil per persoană.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTeamMode(false)}
              className="flex-1 p-3 rounded-2xl border text-left"
              style={{
                borderColor: !teamMode ? 'var(--accent)' : 'var(--border-soft)',
                background: !teamMode ? 'var(--accent-soft)' : 'white',
              }}
            >
              <p className="text-sm font-medium">Individual</p>
              <p className="text-xs text-gray-500">1 calendar, fără alegere de persoană</p>
            </button>
            <button
              onClick={() => setTeamMode(true)}
              className="flex-1 p-3 rounded-2xl border text-left"
              style={{
                borderColor: teamMode ? 'var(--accent)' : 'var(--border-soft)',
                background: teamMode ? 'var(--accent-soft)' : 'white',
              }}
            >
              <p className="text-sm font-medium">Echipă (mai mulți medici/angajați)</p>
              <p className="text-xs text-gray-500">Calendar separat, selectabil, per persoană</p>
            </button>
          </div>
          {teamModeChanged && (
            <div className="flex items-center gap-3">
              <Button onClick={saveTeamMode} disabled={savingTeam}>
                {savingTeam ? 'Se salvează...' : 'Salvează profilul'}
              </Button>
              <span className="text-xs text-amber-600">Modificare nesalvată</span>
            </div>
          )}
          {teamSaved && !teamModeChanged && <p className="text-xs text-green-700">✓ Salvat</p>}
        </Card>}

        {business.category === 'CLINICA' && (
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium">Clinică stomatologică</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Activează odontograma 3D interactivă în fișa fiecărui pacient. Dinții pot fi selectați,
                  marcați ca tratați, cariați, cu coroană/implant sau extrași și pot avea istoric și notițe.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dentalClinic}
                aria-label="Activează clinica stomatologică"
                disabled={savingDentalClinic}
                onClick={() => saveDentalClinic(!dentalClinic)}
                className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${dentalClinic ? 'bg-[var(--accent)]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${dentalClinic ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <p className={`mt-3 text-xs font-medium ${dentalClinic ? 'text-green-700' : 'text-gray-500'}`}>
              {savingDentalClinic ? 'Se salvează…' : dentalClinic ? '✓ Modul stomatologic este activ' : 'Modul stomatologic este oprit'}
            </p>
          </Card>
        )}

        <BillingSection
          key={`${business.billingDueAt}-${business.billingStatus}-${business.billingInvoiceName}`}
          campaignManaged={campaignManaged}
          billingMode={billingMode}
          businessId={business.id}
          initialPlanName={business.planName}
          initialStatus={business.billingStatus}
          initialNote={business.billingNote}
          initialAmount={business.billingAmount}
          initialSubtotal={business.billingSubtotal}
          initialVatRate={business.billingVatRate}
          initialDueAt={business.billingDueAt}
          invoiceName={business.billingInvoiceName}
          paymentState={business.billingIpayPaymentState}
          paymentError={business.billingIpayPaymentError}
          paidAt={business.billingPaidAt}
          initialLegalName={business.billingLegalName ?? ''}
          initialClientType={business.billingClientType}
          initialCif={business.billingCif}
          initialRegCom={business.billingRegCom}
          initialAddress={business.billingAddress}
          initialCounty={business.billingCounty}
          initialCity={business.billingCity}
          initialPostalCode={business.billingPostalCode}
          initialEmail={business.billingEmail}
          initialRepresentativeName={business.contractRepresentativeName}
          initialRepresentativeRole={business.contractRepresentativeRole}
        />
      </div>

      {/* Coloana dreaptă — integrări unificate, plată */}
      <div className="flex flex-col gap-5">
        <SharedIntegrationsCard platformSmsReady={platformSmsReady} adminBusinessId={business.id} businessName={business.name} businessCategory={business.category} isIndividual={business.category === 'FITNESS' || business.teamSize <= 1} channels={channels} practitioners={practitioners} instagramOAuthEnabled={instagramOAuthEnabled} smsGateway={{ apiUrl: business.smsGatewayApiUrl, hasApiKey: business.smsGatewayHasApiKey, deviceId: business.smsGatewayDeviceId, phone: business.smsGatewayPhone, enabled: business.smsGatewayEnabled, testedAt: business.smsGatewayTestedAt, lastError: business.smsGatewayLastError, mode: business.smsGatewayMode, paired: business.smsDevicePaired, lastSeenAt: business.smsDeviceLastSeenAt }} />
        {platformSmsReady && <SmsRoutingSettings businessId={business.id} initial={business.smsSenderMode} />}
      </div>
    </div>
  )
}
