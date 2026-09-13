'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'

const STATUS_LABEL: Record<string, string> = {
  GRATUIT: 'Gratuit (cont demo)',
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
  stripeConfigured: boolean
  canPay: boolean
  paymentResult?: string
}

export function SubscriptionCard({ businessId, planName, billingStatus, amount, currency, dueAt, invoiceName, paidAt, stripeConfigured, canPay, paymentResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dueLabel = dueAt ? new Date(dueAt).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }) : null
  const paidLabel = paidAt ? new Date(paidAt).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' }) : null
  const payable = canPay && Boolean(invoiceName) && amount !== null && amount > 0 && ['NEPLATIT', 'RESTANT'].includes(billingStatus)

  async function payInvoice() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.checkoutUrl) throw new Error(data?.error || 'Plata nu a putut fi inițiată.')
      window.location.assign(data.checkoutUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plata nu a putut fi inițiată.')
      setLoading(false)
    }
  }

  return (
    <Card className="mb-5 break-inside-avoid">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Abonament și factură</h2>
        <Pill tone={STATUS_TONE[billingStatus] ?? 'neutral'}>{STATUS_LABEL[billingStatus] ?? billingStatus}</Pill>
      </div>
      <p className="text-sm text-gray-500">
        {planName ? `Plan: ${planName}` : 'Niciun plan asociat momentan.'}
      </p>
      {(amount !== null || dueLabel) && <p className="text-sm text-gray-600 mt-2">{amount !== null ? `${amount.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : ''}{amount !== null && dueLabel ? ' · ' : ''}{dueLabel ? `Scadență: ${dueLabel}` : ''}</p>}
      {paidLabel && billingStatus === 'PLATIT' && <p className="text-xs text-green-700 mt-2">Plată înregistrată la {paidLabel}.</p>}
      {paymentResult === 'success' && <p className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Plata a fost trimisă. Confirmarea și actualizarea statusului se fac automat prin Stripe.</p>}
      {paymentResult === 'cancelled' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Plata a fost anulată. Factura a rămas neachitată.</p>}
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {invoiceName && <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/api/billing/invoice/${businessId}`} className="btn-secondary inline-flex text-sm">Descarcă factura</a>
        {payable && stripeConfigured && <button type="button" className="btn-primary text-sm" disabled={loading} onClick={payInvoice}>{loading ? 'Se deschide plata…' : 'Plătește cu cardul'}</button>}
      </div>}
      {payable && !stripeConfigured && <p className="text-xs text-amber-700 mt-3">Plata cu cardul va fi disponibilă după activarea contului Stripe.</p>}
      {billingStatus !== 'PLATIT' && billingStatus !== 'GRATUIT' && dueAt && <p className="text-xs text-red-600 mt-3">Serviciul se suspendă automat dacă plata nu este înregistrată în 15 zile de la scadență.</p>}
    </Card>
  )
}
