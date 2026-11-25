'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const STATUS_LABEL: Record<string, string> = {
  GRATUIT: 'Gratuit',
  NEPLATIT: 'Neplătit',
  PLATIT: 'Plătit',
  RESTANT: 'Restant',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  GRATUIT: 'neutral',
  NEPLATIT: 'warning',
  PLATIT: 'success',
  RESTANT: 'danger',
}

type Props = {
  businessId: string
  planName: string | null
  billingStatus: string
  amount: number | null
  currency: string
  dueAt: string | null
  invoiceName: string | null
  paidAt: string | null
  paymentState: string | null
  paymentError: string | null
  paymentResult?: string
  paymentAvailable: boolean
  canInitiatePayment: boolean
}

export function SubscriptionCard({ businessId, planName, billingStatus, amount, currency, dueAt, invoiceName, paidAt, paymentState, paymentError, paymentResult, paymentAvailable, canInitiatePayment }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dueLabel = dueAt ? new Date(dueAt).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }) : null
  const paidLabel = paidAt ? new Date(paidAt).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }) : null
  const paymentPending = ['REGISTERING', 'REGISTERED', 'VERIFYING'].includes(paymentState || '')
  const proAwaitingBilling = planName?.trim().toUpperCase() === 'PRO' && amount === null && !dueAt
  const unpaidInvoice = !proAwaitingBilling && Boolean(invoiceName) && amount !== null && amount > 0 && ['NEPLATIT', 'RESTANT'].includes(billingStatus)
  const canPay = unpaidInvoice && paymentAvailable && canInitiatePayment && !paymentPending && !['REVIEW_REQUIRED', 'DEPOSITED'].includes(paymentState || '')

  async function pay() {
    setBusy(true)
    setError('')
    try {
      const response = await fetchWithTimeout('/api/billing/checkout', { method: 'POST' }, 30_000)
      const data = await response.json().catch(() => ({})) as { paymentUrl?: string; error?: string }
      if (!response.ok || !data.paymentUrl) throw new Error(data.error || 'Plata nu a putut fi inițiată.')
      window.location.assign(data.paymentUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Plata nu a putut fi inițiată.')
      setBusy(false)
    }
  }

  return (
    <Card className="mb-5 break-inside-avoid">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Abonament și factură</h2>
        <Pill tone={proAwaitingBilling ? 'neutral' : STATUS_TONE[billingStatus] ?? 'neutral'}>{proAwaitingBilling ? 'Facturare în configurare' : STATUS_LABEL[billingStatus] ?? billingStatus}</Pill>
      </div>
      <p className="text-sm text-gray-500">{planName ? `Plan: ${planName}` : 'Niciun plan asociat momentan.'}</p>
      {proAwaitingBilling && <p className="mt-2 text-xs text-gray-600">Tariful și facturarea planului PRO sunt stabilite separat cu echipa BookEasy.</p>}
      {(amount !== null || dueLabel) && <p className="text-sm text-gray-600 mt-2">{amount !== null ? `${amount.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : ''}{amount !== null && dueLabel ? ' · ' : ''}{dueLabel ? `Scadență: ${dueLabel}` : ''}</p>}
      {paidLabel && billingStatus === 'PLATIT' && <p className="text-xs text-green-700 mt-2">Plată înregistrată la {paidLabel}.</p>}
      {paymentResult === 'success' && <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Verificăm plata cu banca. Factura va apărea achitată după confirmare.</p>}
      {paymentPending && <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Plata este în curs de verificare. Nu iniția încă o plată pentru aceeași factură.</p>}
      {paymentState === 'DECLINED' && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentError || 'Plata anterioară a fost refuzată.'}</p>}
      {paymentState === 'REVIEW_REQUIRED' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Banca nu a confirmat inițierea. Contactează echipa BookEasy înainte de o nouă încercare.</p>}
      {invoiceName && <div className="mt-3"><a href={`/api/billing/invoice/${businessId}`} className="btn-secondary inline-flex text-sm">Descarcă factura</a></div>}
      {canPay && <button type="button" onClick={() => void pay()} disabled={busy} className="btn-primary mt-3">{busy ? 'Se deschide plata...' : 'Plătește factura cu cardul'}</button>}
      {!paymentAvailable && unpaidInvoice && <p className="text-xs text-gray-600 mt-3">Plata online nu este disponibilă momentan. Contactează echipa BookEasy pentru achitarea facturii.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {billingStatus !== 'PLATIT' && billingStatus !== 'GRATUIT' && dueAt && <p className="text-xs text-red-600 mt-2">Serviciul se suspendă automat dacă plata nu este înregistrată în 15 zile de la scadență.</p>}
    </Card>
  )
}
